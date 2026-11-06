use crate::{model::*, platform, storage::*};
use anyhow::{bail, ensure, Context, Result};
use chrono::Utc;
use futures_util::StreamExt;
use sha2::{Digest, Sha256};
use std::collections::{BTreeMap, HashMap, HashSet};
use std::fs::{self, File};
use std::path::{Path, PathBuf};
use std::process::Child;
use std::sync::{
    atomic::{AtomicBool, AtomicU64, Ordering},
    Arc, Mutex,
};
use std::time::{Duration, Instant};

struct OperationGuard<'a> {
    owner: &'a Mutex<HashSet<String>>,
    id: String,
}
impl Drop for OperationGuard<'_> {
    fn drop(&mut self) {
        self.owner.lock().unwrap().remove(&self.id);
    }
}
type Sink = Arc<dyn Fn(Snapshot) + Send + Sync>;
struct Store {
    disk: DiskState,
    catalog: Catalog,
    source: String,
    checked_at: Option<String>,
    warnings: Vec<String>,
}

pub struct Engine {
    revision: AtomicU64,
    operations: Mutex<HashSet<String>>,
    data_dir: PathBuf,
    trust: Trust,
    store: Mutex<Store>,
    children: Mutex<HashMap<String, Child>>,
    cancel: Mutex<HashMap<String, Arc<AtomicBool>>>,
    sink: Mutex<Option<Sink>>,
    queue_lock: tokio::sync::Mutex<()>,
    _lock: File,
}

impl Engine {
    pub fn open(data_dir: PathBuf) -> Result<Arc<Self>> {
        let trust: Trust = serde_json::from_str(include_str!("../../../catalog/trust.json"))?;
        let bundled: Catalog = serde_json::from_str(include_str!("../../../catalog/bundled.json"))?;
        Self::with_catalog(data_dir, trust, bundled)
    }

    pub fn with_catalog(data_dir: PathBuf, trust: Trust, bundled: Catalog) -> Result<Arc<Self>> {
        bundled.validate(&trust)?;
        let lock = acquire_lock(&data_dir)?;
        let state_path = data_dir.join("state.json");
        let mut disk: DiskState = if state_path.exists() {
            let bytes = fs::read(&state_path)?;
            ensure!(bytes.len() <= 5_000_000, "Arquivo de estado muito grande");
            serde_json::from_slice(&bytes).context("O estado local está danificado; consulte docs/TROUBLESHOOTING.md antes de recuperá-lo")?
        } else {
            DiskState {
                schema_version: 1,
                settings: Settings {
                    theme: "light".into(),
                    language: "pt-BR".into(),
                    channel: "stable".into(),
                    check_on_start: true,
                    install_root: default_install_root().to_string_lossy().into(),
                    catalog_url: trust.catalog_url.clone(),
                    hidden_apps: vec![],
                },
                inventory: BTreeMap::new(),
                jobs: vec![],
            }
        };
        ensure!(
            disk.schema_version == 1,
            "Estado criado por uma versão incompatível do launcher"
        );
        // Older installations started with a local-only catalog. Adopt the newly
        // configured official endpoint while preserving an explicit custom URL.
        if disk.settings.catalog_url.is_none() {
            disk.settings.catalog_url = trust.catalog_url.clone();
        }
        disk.settings.validate(&trust)?;
        let mut warnings = vec![];
        for job in &mut disk.jobs {
            if is_active(&job.phase) {
                job.phase = "interrupted".into();
                job.error =
                    Some("Operação interrompida. Confira a instalação e tente novamente".into());
            }
        }
        let mut catalog = bundled;
        let mut source = "bundled".to_owned();
        let cache = data_dir.join("catalog-cache.json");
        if cache.exists() {
            let cached = fs::read(&cache)
                .ok()
                .filter(|b| b.len() <= 3_000_000)
                .and_then(|b| serde_json::from_slice::<Envelope>(&b).ok())
                .and_then(|e| trust.open_envelope(&e).ok());
            if let Some(cached) = cached {
                catalog = cached;
                source = "cache".into();
            } else {
                warnings.push("O catálogo salvo não pôde ser verificado. Usando o catálogo incluído no launcher".into());
            }
        }
        for (id, item) in &mut disk.inventory {
            ensure!(
                valid_id(id) && id == &item.app_id && valid_version(&item.version),
                "Inventário local inválido"
            );
            item.present = Path::new(&item.executable).is_file();
            item.modified = item.present && platform::checked_executable(item).is_err();
        }
        let cache_dir = data_dir.join("downloads");
        fs::create_dir_all(&cache_dir)?;
        for entry in fs::read_dir(&cache_dir)?.flatten() {
            if entry
                .path()
                .extension()
                .is_some_and(|e| e == "part" || e == "exe")
                && entry.file_type()?.is_file()
            {
                let _ = fs::remove_file(entry.path());
            }
        }
        atomic_json(&state_path, &disk)?;
        Ok(Arc::new(Self {
            revision: AtomicU64::new(0),
            operations: Mutex::new(HashSet::new()),
            data_dir,
            trust,
            store: Mutex::new(Store {
                disk,
                catalog,
                source,
                checked_at: None,
                warnings,
            }),
            children: Mutex::new(HashMap::new()),
            cancel: Mutex::new(HashMap::new()),
            sink: Mutex::new(None),
            queue_lock: tokio::sync::Mutex::new(()),
            _lock: lock,
        }))
    }

    /// Repair menu integration once on native startup, including already-installed apps.
    pub fn integrate_desktop(&self) {
        #[cfg(target_os = "linux")]
        {
            let result = (|| {
                let data = dirs::data_dir().context("Menu de aplicativos não encontrado")?;
                let appimage = std::env::var_os("APPIMAGE").map(PathBuf::from);
                self.integrate_desktop_in(&data, appimage.as_deref())
            })();
            if let Err(error) = result {
                self.store
                    .lock()
                    .unwrap()
                    .warnings
                    .push(format!("Não foi possível integrar o menu Linux: {error}"));
            }
        }
    }

    #[cfg(target_os = "linux")]
    pub(crate) fn integrate_desktop_in(&self, data: &Path, appimage: Option<&Path>) -> Result<()> {
        let mut store = self.store.lock().unwrap();
        let names: BTreeMap<_, _> = store
            .catalog
            .apps
            .iter()
            .map(|app| (app.id.clone(), app.name.clone()))
            .collect();
        let mut warnings = vec![];
        for item in store.disk.inventory.values_mut() {
            if let Some(name) = names.get(&item.app_id) {
                item.name.clone_from(name);
            }
            if !item.present || item.modified {
                continue;
            }
            if let Err(error) = crate::desktop::write_app_shortcut(data, item) {
                warnings.push(format!(
                    "Não foi possível criar o atalho de {}: {error}",
                    item.name
                ));
            }
        }
        if let Some(appimage) = appimage {
            if let Err(error) = crate::desktop::register_launcher(data, appimage) {
                warnings.push(format!(
                    "Não foi possível criar o atalho do Struct Launcher: {error}"
                ));
            }
        }
        store.warnings.extend(warnings);
        self.save(&store)
    }

    fn operation(&self, id: &str) -> Result<OperationGuard<'_>> {
        let mut operations = self.operations.lock().unwrap();
        ensure!(
            operations.insert(id.to_owned()),
            "Este aplicativo já está sendo alterado"
        );
        Ok(OperationGuard {
            owner: &self.operations,
            id: id.into(),
        })
    }

    pub fn reconcile(&self) -> Result<Snapshot> {
        let mut store = self.store.lock().unwrap();
        let mut changed = false;
        for item in store.disk.inventory.values_mut() {
            let present = Path::new(&item.executable).is_file();
            let modified = present && platform::checked_executable(item).is_err();
            changed |= present != item.present || modified != item.modified;
            item.present = present;
            item.modified = modified;
        }
        if changed {
            self.save(&store)?;
        }
        drop(store);
        Ok(self.snapshot())
    }

    pub fn set_sink(&self, sink: Sink) {
        *self.sink.lock().unwrap() = Some(sink);
    }
    pub fn data_dir(&self) -> &Path {
        &self.data_dir
    }
    pub fn trust(&self) -> &Trust {
        &self.trust
    }
    fn save(&self, store: &Store) -> Result<()> {
        atomic_json(&self.data_dir.join("state.json"), &store.disk)
    }
    fn emit(&self) {
        let sink = self.sink.lock().unwrap().clone();
        if let Some(sink) = sink {
            sink(self.snapshot());
        }
    }

    pub fn snapshot(&self) -> Snapshot {
        let mut children = self.children.lock().unwrap();
        children.retain(|_, child| child.try_wait().map(|s| s.is_none()).unwrap_or(false));
        let store = self.store.lock().unwrap();
        let running_apps = store
            .disk
            .inventory
            .values()
            .filter(|item| children.contains_key(&item.app_id) || platform::is_running(item))
            .map(|item| item.app_id.clone())
            .collect();
        Snapshot {
            revision: self.revision.fetch_add(1, Ordering::Relaxed),
            catalog: store.catalog.clone(),
            settings: store.disk.settings.clone(),
            inventory: store.disk.inventory.clone(),
            jobs: store.disk.jobs.clone(),
            platform: std::env::consts::OS.into(),
            arch: std::env::consts::ARCH.into(),
            native: true,
            catalog_source: store.source.clone(),
            checked_at: store.checked_at.clone(),
            warnings: store.warnings.clone(),
            running_apps,
            launcher_version: VERSION.into(),
        }
    }

    pub fn save_settings(&self, mut settings: Settings) -> Result<Snapshot> {
        if settings.catalog_url.is_none() {
            settings.catalog_url = self.trust.catalog_url.clone();
        }
        settings.validate(&self.trust)?;
        ensure!(
            !settings.install_root.chars().any(|c| c.is_control()),
            "Pasta de instalação inválida"
        );
        let mut store = self.store.lock().unwrap();
        let previous = store.disk.settings.clone();
        store.disk.settings = settings;
        if let Err(error) = self.save(&store) {
            store.disk.settings = previous;
            return Err(error);
        }
        drop(store);
        self.emit();
        Ok(self.snapshot())
    }

    fn client(&self) -> Result<reqwest::Client> {
        let trust = self.trust.clone();
        Ok(reqwest::Client::builder()
            .connect_timeout(Duration::from_secs(15))
            .timeout(Duration::from_secs(1800))
            .user_agent(format!("StructLauncher/{VERSION}"))
            .redirect(reqwest::redirect::Policy::custom(move |attempt| {
                if attempt.previous().len() >= 5 {
                    return attempt.error("Redirecionamentos demais");
                }
                if trust.check_url(attempt.url().as_str()).is_ok() {
                    attempt.follow()
                } else {
                    attempt.error("Redirecionamento para origem não autorizada")
                }
            }))
            .build()?)
    }

    pub async fn refresh_catalog(&self) -> Result<Snapshot> {
        self.reconcile()?;
        let url = self.store.lock().unwrap().disk.settings.catalog_url.clone();
        let Some(url) = url.filter(|s| !s.is_empty()) else {
            self.store.lock().unwrap().checked_at = Some(Utc::now().to_rfc3339());
            self.emit();
            return Ok(self.snapshot());
        };
        self.trust.check_url(&url)?;
        let response = self.client()?.get(url).send().await?.error_for_status()?;
        ensure!(
            response.content_length().unwrap_or(0) <= 3_000_000,
            "Catálogo muito grande"
        );
        let mut body = Vec::new();
        let mut stream = response.bytes_stream();
        while let Some(chunk) = tokio::time::timeout(Duration::from_secs(30), stream.next()).await?
        {
            let chunk = chunk?;
            ensure!(
                body.len() + chunk.len() <= 3_000_000,
                "Catálogo muito grande"
            );
            body.extend_from_slice(&chunk);
        }
        let envelope: Envelope = serde_json::from_slice(&body)?;
        let catalog = self.trust.open_envelope(&envelope)?;
        let mut store = self.store.lock().unwrap();
        ensure!(
            chrono::DateTime::parse_from_rfc3339(&catalog.published_at)?
                >= chrono::DateTime::parse_from_rfc3339(&store.catalog.published_at)?,
            "O servidor enviou um catálogo anterior ao já conhecido"
        );
        ensure!(
            !store.disk.jobs.iter().any(|j| is_active(&j.phase)),
            "Aguarde os downloads terminarem antes de trocar o catálogo"
        );
        atomic_json(&self.data_dir.join("catalog-cache.json"), &envelope)?;
        store.catalog = catalog;
        store.source = "remote".into();
        store.checked_at = Some(Utc::now().to_rfc3339());
        store.warnings.clear();
        drop(store);
        self.emit();
        Ok(self.snapshot())
    }

    fn select(
        &self,
        store: &Store,
        id: &str,
        version: &str,
    ) -> Result<(Product, Release, Package)> {
        ensure_supported_host()?;
        let app = store.catalog.product(id)?.clone();
        let release = app
            .releases
            .iter()
            .find(|r| r.version == version)
            .context("Versão não encontrada")?
            .clone();
        ensure!(
            store.disk.settings.channel == "beta" || release.channel == "stable",
            "Ative o canal de pré-lançamentos nas configurações"
        );
        let asset = release
            .assets
            .iter()
            .find(|a| a.platform == std::env::consts::OS && a.arch == std::env::consts::ARCH)
            .context("Não há pacote para este sistema e arquitetura")?
            .clone();
        ensure!(
            semver::Version::parse(VERSION)?
                >= semver::Version::parse(&asset.min_launcher_version)?,
            "Atualize o launcher antes de instalar este pacote"
        );
        asset.verify_signature(&self.trust, id, version)?;
        Ok((app, release, asset))
    }

    pub fn enqueue(&self, id: &str, version: &str, allow_downgrade: bool) -> Result<Snapshot> {
        let mut store = self.store.lock().unwrap();
        let (app, _, asset) = self.select(&store, id, version)?;
        ensure!(
            !self.operations.lock().unwrap().contains(id),
            "Este aplicativo já está sendo alterado"
        );
        ensure!(
            !store
                .disk
                .jobs
                .iter()
                .any(|j| j.app_id == id && is_active(&j.phase)),
            "Este aplicativo já está na fila"
        );
        ensure!(
            store
                .disk
                .jobs
                .iter()
                .filter(|j| is_active(&j.phase))
                .count()
                < 20,
            "A fila está cheia"
        );
        if let Some(installed) = store.disk.inventory.get(id) {
            ensure!(
                !platform::is_running(installed),
                "Feche o aplicativo antes de atualizar"
            );
            ensure!(
                allow_downgrade || !newer(&installed.version, version)?,
                "Confirme a instalação de uma versão anterior"
            );
        }
        store.disk.jobs.push(Job {
            id: uuid::Uuid::new_v4().to_string(),
            app_id: id.into(),
            app_name: app.name,
            version: version.into(),
            phase: "queued".into(),
            received: 0,
            total: asset.size,
            created_at: Utc::now().to_rfc3339(),
            error: None,
            allow_downgrade,
        });
        self.save(&store)?;
        drop(store);
        self.emit();
        Ok(self.snapshot())
    }

    pub fn cancel_job(&self, id: &str) -> Result<Snapshot> {
        let mut store = self.store.lock().unwrap();
        let job = store
            .disk
            .jobs
            .iter_mut()
            .find(|j| j.id == id)
            .context("Download não encontrado")?;
        ensure!(
            matches!(job.phase.as_str(), "queued" | "downloading" | "verifying"),
            "Esta operação já está instalando ou foi concluída"
        );
        if let Some(cancel) = self.cancel.lock().unwrap().get(id) {
            cancel.store(true, Ordering::Relaxed);
        }
        if job.phase == "queued" {
            job.phase = "cancelled".into();
        }
        self.save(&store)?;
        drop(store);
        self.emit();
        Ok(self.snapshot())
    }

    pub fn clear_history(&self) -> Result<Snapshot> {
        let mut store = self.store.lock().unwrap();
        store.disk.jobs.retain(|j| is_active(&j.phase));
        self.save(&store)?;
        drop(store);
        self.emit();
        Ok(self.snapshot())
    }

    fn progress(
        &self,
        id: &str,
        phase: &str,
        received: u64,
        error: Option<String>,
        persist: bool,
    ) -> Result<()> {
        let mut store = self.store.lock().unwrap();
        if let Some(job) = store.disk.jobs.iter_mut().find(|j| j.id == id) {
            job.phase = phase.into();
            job.received = received;
            job.error = error;
        }
        if persist {
            self.save(&store)?;
        }
        drop(store);
        self.emit();
        Ok(())
    }

    pub async fn process_queue(self: Arc<Self>) {
        let _guard = self.queue_lock.lock().await;
        loop {
            let next = {
                let mut store = self.store.lock().unwrap();
                if let Some(job) = store.disk.jobs.iter_mut().find(|j| j.phase == "queued") {
                    let flag = Arc::new(AtomicBool::new(false));
                    self.cancel
                        .lock()
                        .unwrap()
                        .insert(job.id.clone(), flag.clone());
                    job.phase = "downloading".into();
                    Some((job.clone(), flag))
                } else {
                    None
                }
            };
            let Some((job, flag)) = next else {
                break;
            };
            let result = self.execute(&job, flag.clone()).await;
            let received = {
                self.store
                    .lock()
                    .unwrap()
                    .disk
                    .jobs
                    .iter()
                    .find(|j| j.id == job.id)
                    .map(|j| j.received)
                    .unwrap_or(0)
            };
            let _ = match result {
                Ok(()) => self.progress(&job.id, "complete", job.total, None, true),
                Err(error) => self.progress(
                    &job.id,
                    if flag.load(Ordering::Relaxed) {
                        "cancelled"
                    } else {
                        "failed"
                    },
                    received,
                    Some(format!("{error:#}")),
                    true,
                ),
            };
            self.cancel.lock().unwrap().remove(&job.id);
        }
    }

    async fn execute(&self, job: &Job, cancel: Arc<AtomicBool>) -> Result<()> {
        let (app, _, asset, root, previous) = {
            let store = self.store.lock().unwrap();
            let (app, release, asset) = self.select(&store, &job.app_id, &job.version)?;
            let previous = store.disk.inventory.get(&job.app_id).cloned();
            let root = previous
                .as_ref()
                .map(|i| i.root.clone())
                .unwrap_or_else(|| store.disk.settings.install_root.clone());
            (app, release, asset, root, previous)
        };
        self.progress(&job.id, "downloading", 0, None, true)?;
        let url = self.trust.check_url(&asset.url)?;
        let cache = self.data_dir.join("downloads");
        ensure!(
            fs2::available_space(&cache)? > asset.size.saturating_mul(2) + 16_000_000,
            "Não há espaço livre suficiente para baixar o pacote"
        );
        fs::create_dir_all(&root)?;
        ensure!(
            fs2::available_space(&root)? > asset.size.saturating_mul(3) + 16_000_000,
            "Não há espaço livre suficiente para instalar"
        );
        let downloaded = tempfile::Builder::new()
            .prefix("openstruct-")
            .suffix(if asset.kind == "nsis" {
                ".exe"
            } else {
                ".part"
            })
            .tempfile_in(&cache)?;
        let file = downloaded.reopen()?;
        let downloaded = downloaded.into_temp_path();
        self.download(url, file, &asset, &job.id, cancel.clone())
            .await?;
        ensure!(!cancel.load(Ordering::Relaxed), "Download cancelado");
        self.progress(&job.id, "verifying", asset.size, None, true)?;
        asset.verify_signature(&self.trust, &app.id, &job.version)?;
        let source = downloaded.to_path_buf();
        let expected = asset.sha256.clone();
        tokio::task::spawn_blocking(move || -> Result<()> {
            ensure!(
                digest(&source)? == expected,
                "A integridade do arquivo não confere"
            );
            Ok(())
        })
        .await??;
        ensure!(!cancel.load(Ordering::Relaxed), "Download cancelado");
        let _operation = self.operation(&job.app_id)?;
        if let Some(item) = &previous {
            ensure!(
                !platform::is_running(item),
                "Feche o aplicativo para concluir a atualização e tente novamente"
            );
        }
        {
            let mut store = self.store.lock().unwrap();
            ensure!(!cancel.load(Ordering::Relaxed), "Download cancelado");
            let current = store
                .disk
                .jobs
                .iter_mut()
                .find(|j| j.id == job.id)
                .context("Operação não encontrada")?;
            current.phase = "installing".into();
            current.received = asset.size;
            self.save(&store)?;
        }
        self.emit();
        let source = downloaded.to_path_buf();
        let install_root = PathBuf::from(&root);
        let product = app.clone();
        let version = job.version.clone();
        let package = asset.clone();
        let executable = tokio::task::spawn_blocking(move || {
            platform::install(&source, &install_root, &product, &version, &package)
        })
        .await??;
        let hash_path = executable.clone();
        let hash = tokio::task::spawn_blocking(move || digest(&hash_path)).await??;
        let item = Installed {
            app_id: app.id.clone(),
            name: app.name,
            version: job.version.clone(),
            kind: asset.kind,
            root: dunce::canonicalize(&root)?.to_string_lossy().into(),
            executable: executable.to_string_lossy().into(),
            executable_sha256: hash,
            installed_at: Utc::now().to_rfc3339(),
            present: true,
            modified: false,
            previous_version: previous
                .as_ref()
                .map(|i| i.version.clone())
                .filter(|v| v != &job.version),
        };
        let mut store = self.store.lock().unwrap();
        store.disk.inventory.insert(app.id, item.clone());
        if let Err(error) = platform::write_shortcut(&item) {
            store.warnings.push(format!(
                "Instalado, mas não foi possível criar o atalho: {error}"
            ));
        }
        self.save(&store)?;
        Ok(())
    }

    pub(crate) async fn download(
        &self,
        url: url::Url,
        file: File,
        asset: &Package,
        id: &str,
        cancel: Arc<AtomicBool>,
    ) -> Result<()> {
        use tokio::io::AsyncWriteExt;
        let mut file = tokio::fs::File::from_std(file);
        let response = tokio::select! {
            response = self.client()?.get(url).send() => response?.error_for_status()?,
            _ = wait_cancel(cancel.clone()) => bail!("Download cancelado"),
        };
        if let Some(length) = response.content_length() {
            ensure!(
                length == asset.size,
                "O tamanho anunciado não confere com o catálogo"
            );
        }
        let mut stream = response.bytes_stream();
        let mut received: u64 = 0;
        let mut hasher = Sha256::new();
        let mut last = Instant::now();
        loop {
            ensure!(!cancel.load(Ordering::Relaxed), "Download cancelado");
            let chunk = tokio::select! {
                chunk = tokio::time::timeout(Duration::from_secs(30), stream.next()) => chunk.context("O download ficou sem resposta; tente novamente")?,
                _ = wait_cancel(cancel.clone()) => bail!("Download cancelado"),
            };
            let Some(chunk) = chunk else {
                break;
            };
            let chunk = chunk?;
            received = received
                .checked_add(chunk.len() as u64)
                .context("Tamanho inválido")?;
            ensure!(
                received <= asset.size,
                "O download excedeu o tamanho esperado"
            );
            hasher.update(&chunk);
            file.write_all(&chunk).await?;
            if last.elapsed() >= Duration::from_millis(200) {
                self.progress(id, "downloading", received, None, false)?;
                last = Instant::now();
            }
        }
        file.sync_all().await?;
        ensure!(received == asset.size, "O download está incompleto");
        ensure!(
            hex::encode(hasher.finalize()) == asset.sha256,
            "O SHA-256 do pacote não confere; o arquivo não será instalado"
        );
        Ok(())
    }

    pub fn launch(&self, id: &str) -> Result<Snapshot> {
        let _operation = self.operation(id)?;
        let store = self.store.lock().unwrap();
        ensure!(
            !store
                .disk
                .jobs
                .iter()
                .any(|j| j.app_id == id && is_active(&j.phase)),
            "Aguarde a operação deste aplicativo terminar"
        );
        let item = store
            .disk
            .inventory
            .get(id)
            .context("Aplicativo não instalado")?
            .clone();
        drop(store);
        let mut children = self.children.lock().unwrap();
        if let Some(child) = children.get_mut(id) {
            ensure!(child.try_wait()?.is_some(), "O aplicativo já está aberto");
        }
        ensure!(!platform::is_running(&item), "O aplicativo já está aberto");
        children.insert(id.into(), platform::launch(&item)?);
        drop(children);
        self.emit();
        Ok(self.snapshot())
    }

    pub fn uninstall(&self, id: &str) -> Result<Snapshot> {
        let _operation = self.operation(id)?;
        let store = self.store.lock().unwrap();
        ensure!(
            !store
                .disk
                .jobs
                .iter()
                .any(|j| j.app_id == id && is_active(&j.phase)),
            "Aguarde a operação deste aplicativo terminar"
        );
        let item = store
            .disk
            .inventory
            .get(id)
            .context("Aplicativo não instalado")?
            .clone();
        drop(store);
        platform::uninstall(&item)?;
        let mut store = self.store.lock().unwrap();
        store.disk.inventory.remove(id);
        self.save(&store)?;
        drop(store);
        self.emit();
        Ok(self.snapshot())
    }

    pub fn product_link(&self, id: &str, kind: &str) -> Result<String> {
        let store = self.store.lock().unwrap();
        let product = store.catalog.product(id)?;
        let link = match kind {
            "website" => &product.website,
            "repository" => &product.repository,
            "documentation" => &product.documentation,
            _ => bail!("Link desconhecido"),
        };
        validate_https(link)?;
        Ok(link.clone())
    }

    pub fn app_folder(&self, id: &str) -> Result<PathBuf> {
        let store = self.store.lock().unwrap();
        platform::folder(
            store
                .disk
                .inventory
                .get(id)
                .context("Aplicativo não instalado")?,
        )
    }
}

async fn wait_cancel(flag: Arc<AtomicBool>) {
    while !flag.load(Ordering::Relaxed) {
        tokio::time::sleep(Duration::from_millis(50)).await;
    }
}
