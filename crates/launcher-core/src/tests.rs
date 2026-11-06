use super::*;
use base64::{engine::general_purpose::STANDARD, Engine as _};
use std::collections::BTreeMap;
use std::fs;
use std::sync::{atomic::AtomicBool, Arc};
use tempfile::TempDir;

fn vector() -> serde_json::Value {
    serde_json::from_str(include_str!(
        "../../../tests/fixtures/signature-vector.json"
    ))
    .unwrap()
}
fn trust() -> Trust {
    Trust {
        catalog_url: None,
        keys: BTreeMap::from([(
            "test-only".into(),
            vector()["publicKey"].as_str().unwrap().into(),
        )]),
        allowed_hosts: vec!["github.com".into()],
    }
}
fn envelope() -> Envelope {
    serde_json::from_value(vector()["envelope"].clone()).unwrap()
}
fn catalog() -> Catalog {
    trust().open_envelope(&envelope()).unwrap()
}
fn asset() -> Package {
    serde_json::from_value(vector()["asset"].clone()).unwrap()
}
fn engine(temp: &TempDir) -> Arc<Engine> {
    Engine::with_catalog(temp.path().join("data"), trust(), catalog()).unwrap()
}

#[test]
fn bundled_catalog_is_valid_and_has_no_fictional_downloads() {
    let trust: Trust = serde_json::from_str(include_str!("../../../catalog/trust.json")).unwrap();
    let catalog: Catalog =
        serde_json::from_str(include_str!("../../../catalog/bundled.json")).unwrap();
    catalog.validate(&trust).unwrap();
    assert_eq!(catalog.apps.len(), 2);
    assert!(catalog.apps.iter().all(|app| app.releases.is_empty()));
}

#[test]
fn package_signature_matches_node_and_binds_identity_and_version() {
    let asset = asset();
    asset
        .verify_signature(&trust(), "consolostruct", "1.0.0")
        .unwrap();
    assert!(asset
        .verify_signature(&trust(), "molastruct", "1.0.0")
        .is_err());
    assert!(asset
        .verify_signature(&trust(), "consolostruct", "1.0.1")
        .is_err());
    let mut changed = asset;
    changed.size += 1;
    assert!(changed
        .verify_signature(&trust(), "consolostruct", "1.0.0")
        .is_err());
}

#[test]
fn catalog_signature_rejects_tampering_and_unknown_keys() {
    let mut envelope = envelope();
    assert!(trust().open_envelope(&envelope).is_ok());
    envelope.payload.push(' ');
    assert!(trust().open_envelope(&envelope).is_err());
    envelope.key_id = "unknown".into();
    assert!(trust().open_envelope(&envelope).is_err());
}

#[test]
fn catalog_rejects_traversal_duplicate_ids_and_invalid_targets() {
    let mut c = catalog();
    c.apps[0].id = "../other".into();
    assert!(c.validate(&trust()).is_err());
    let mut c = catalog();
    c.apps.push(c.apps[0].clone());
    assert!(c.validate(&trust()).is_err());
    let mut c = catalog();
    c.apps[0].releases[0].assets[0].kind = "nsis".into();
    assert!(c.validate(&trust()).is_err());
}

#[test]
fn catalog_rejects_unsigned_packages_and_unknown_schema() {
    let mut c = catalog();
    c.apps[0].releases[0].assets[0].signature = "".into();
    assert!(c.validate(&trust()).is_err());
    let mut c = catalog();
    c.schema_version = 2;
    assert!(c.validate(&trust()).is_err());
}

#[test]
fn transport_rejects_http_credentials_ports_and_untrusted_hosts() {
    for url in [
        "http://github.com/file",
        "https://user:password@github.com/file",
        "https://github.com:9999/file",
        "https://github.com.evil.example/file",
        "file:///tmp/installer",
    ] {
        assert!(trust().check_url(url).is_err(), "{url}");
    }
    assert!(trust().check_url("https://github.com/example/file").is_ok());
}

#[test]
fn windows_paths_and_versions_are_not_shell_or_traversal_input() {
    for value in [
        "../evil.exe",
        "..\\evil.exe",
        "C:/evil.exe",
        "/evil.exe",
        "evil.exe\0",
        "./evil.exe",
    ] {
        assert!(!model::valid_relative_exe(value), "{value}");
    }
    assert!(model::valid_relative_exe("app.exe"));
    assert!(!model::valid_version("../../1.0.0"));
    assert!(model::newer("0.10.0", "0.9.0").unwrap());
    assert!(!model::newer("1.0.0-beta.2", "1.0.0").unwrap());
}

#[test]
fn only_one_launcher_may_modify_an_inventory() {
    let temp = TempDir::new().unwrap();
    let first = engine(&temp);
    assert!(Engine::with_catalog(temp.path().join("data"), trust(), catalog()).is_err());
    drop(first);
    assert!(Engine::with_catalog(temp.path().join("data"), trust(), catalog()).is_ok());
}

#[test]
fn settings_are_validated_and_persisted() {
    let temp = TempDir::new().unwrap();
    let e = engine(&temp);
    let mut settings = e.snapshot().settings;
    settings.theme = "dark".into();
    settings.install_root = temp.path().join("apps").to_string_lossy().into();
    e.save_settings(settings.clone()).unwrap();
    drop(e);
    let e = engine(&temp);
    assert_eq!(e.snapshot().settings.theme, "dark");
    settings.catalog_url = Some("http://example.org".into());
    assert!(e.save_settings(settings).is_err());
}

#[test]
fn interrupted_jobs_are_not_reported_as_installed_and_partial_files_are_removed() {
    let temp = TempDir::new().unwrap();
    let e = engine(&temp);
    let snap = e.snapshot();
    let state = DiskState {
        schema_version: 1,
        settings: snap.settings,
        inventory: snap.inventory,
        jobs: vec![Job {
            id: "interrupted-test".into(),
            app_id: "consolostruct".into(),
            app_name: "Test".into(),
            version: "1.0.0".into(),
            phase: "installing".into(),
            received: 30,
            total: 40,
            created_at: chrono::Utc::now().to_rfc3339(),
            error: None,
            allow_downgrade: false,
        }],
    };
    storage::atomic_json(&e.data_dir().join("state.json"), &state).unwrap();
    fs::write(e.data_dir().join("downloads/partial.part"), b"incomplete").unwrap();
    drop(e);
    let e = engine(&temp);
    let snap = e.snapshot();
    assert_eq!(snap.jobs[0].phase, "interrupted");
    assert!(snap.inventory.is_empty());
    assert!(!e.data_dir().join("downloads/partial.part").exists());
}

#[test]
fn state_file_replacement_is_atomic_and_cache_requires_a_signature() {
    let temp = TempDir::new().unwrap();
    let path = temp.path().join("state.json");
    storage::atomic_json(&path, &serde_json::json!({"version":1})).unwrap();
    storage::atomic_json(&path, &serde_json::json!({"version":2})).unwrap();
    assert_eq!(
        serde_json::from_slice::<serde_json::Value>(&fs::read(path).unwrap()).unwrap()["version"],
        2
    );
    let e = engine(&temp);
    fs::write(
        e.data_dir().join("catalog-cache.json"),
        br#"{"payload":"forged","signature":"bad","keyId":"test-only"}"#,
    )
    .unwrap();
    drop(e);
    let e = engine(&temp);
    assert_eq!(e.snapshot().catalog_source, "bundled");
    assert_eq!(e.snapshot().warnings.len(), 1);
}

#[test]
fn cancellation_and_history_keep_active_jobs() {
    let temp = TempDir::new().unwrap();
    let e = engine(&temp);
    #[cfg(target_os = "linux")]
    {
        e.enqueue("consolostruct", "1.0.0", false).unwrap();
        assert!(e.enqueue("consolostruct", "1.0.0", false).is_err());
        e.clear_history().unwrap();
        assert_eq!(e.snapshot().jobs.len(), 1);
        let id = e.snapshot().jobs[0].id.clone();
        e.cancel_job(&id).unwrap();
        assert_eq!(e.snapshot().jobs[0].phase, "cancelled");
        e.clear_history().unwrap();
        assert!(e.snapshot().jobs.is_empty());
    }
    #[cfg(target_os = "windows")]
    {
        assert!(e.enqueue("consolostruct", "1.0.0", false).is_err());
    }
}

fn server(body: Vec<u8>, redirect: bool) -> (url::Url, std::thread::JoinHandle<()>) {
    let server = tiny_http::Server::http("127.0.0.1:0").unwrap();
    let url = format!("http://{}", server.server_addr());
    let thread = std::thread::spawn(move || {
        if let Some(request) = server
            .recv_timeout(std::time::Duration::from_secs(10))
            .unwrap()
        {
            if redirect {
                request
                    .respond(
                        tiny_http::Response::empty(302).with_header(
                            tiny_http::Header::from_bytes(
                                "Location",
                                "https://not-allowed.example/file",
                            )
                            .unwrap(),
                        ),
                    )
                    .unwrap();
            } else {
                let _ = request.respond(tiny_http::Response::from_data(body));
            }
        }
    });
    (url.parse().unwrap(), thread)
}

#[tokio::test]
async fn real_http_download_verifies_length_and_digest() {
    // HTTP is used only here, by calling a crate-private transfer helper. Production
    // entry points validate HTTPS + host policy before reaching this helper.
    let temp = TempDir::new().unwrap();
    let e = engine(&temp);
    let file = tempfile::NamedTempFile::new().unwrap();
    let body = STANDARD
        .decode(vector()["payloadBase64"].as_str().unwrap())
        .unwrap();
    let (url, server) = server(body.clone(), false);
    e.download(
        url,
        fs::File::options().write(true).open(file.path()).unwrap(),
        &asset(),
        "test",
        Arc::new(AtomicBool::new(false)),
    )
    .await
    .unwrap();
    server.join().unwrap();
    assert_eq!(fs::read(file.path()).unwrap(), body);
}

#[tokio::test]
async fn corrupt_incomplete_and_redirected_downloads_are_rejected() {
    for (body, redirect) in [
        (vec![0; asset().size as usize], false),
        (vec![0; 3], false),
        (vec![], true),
    ] {
        let temp = TempDir::new().unwrap();
        let e = engine(&temp);
        let file = tempfile::NamedTempFile::new().unwrap();
        let (url, server) = server(body, redirect);
        assert!(e
            .download(
                url,
                fs::File::options().write(true).open(file.path()).unwrap(),
                &asset(),
                "test",
                Arc::new(AtomicBool::new(false))
            )
            .await
            .is_err());
        server.join().unwrap();
    }
}

#[tokio::test]
async fn cancelled_transfer_does_not_succeed() {
    let temp = TempDir::new().unwrap();
    let e = engine(&temp);
    let file = tempfile::NamedTempFile::new().unwrap();
    let body = STANDARD
        .decode(vector()["payloadBase64"].as_str().unwrap())
        .unwrap();
    let (url, server) = server(body, false);
    assert!(e
        .download(
            url,
            fs::File::options().write(true).open(file.path()).unwrap(),
            &asset(),
            "test",
            Arc::new(AtomicBool::new(true))
        )
        .await
        .is_err());
    server.join().unwrap();
}

#[cfg(target_os = "linux")]
#[test]
fn linux_install_is_staged_and_uninstall_preserves_project_files() {
    let temp = TempDir::new().unwrap();
    let root = temp.path().join("apps");
    let project = temp.path().join("project.molas.json");
    fs::write(&project, "project data").unwrap();
    let source = temp.path().join("test.AppImage");
    let mut bytes = vec![0u8; 1024];
    bytes[..4].copy_from_slice(b"\x7fELF");
    bytes[8..11].copy_from_slice(b"AI\x02");
    fs::write(&source, bytes).unwrap();
    let mut package = asset();
    package.sha256 = storage::digest(&source).unwrap();
    let app = catalog().apps.remove(0);
    let path = platform::install(&source, &root, &app, "1.0.0", &package).unwrap();
    let item = Installed {
        app_id: app.id,
        name: app.name,
        version: "1.0.0".into(),
        kind: "appimage".into(),
        root: root.to_string_lossy().into(),
        executable: path.to_string_lossy().into(),
        executable_sha256: storage::digest(&path).unwrap(),
        installed_at: chrono::Utc::now().to_rfc3339(),
        present: true,
        modified: false,
        previous_version: None,
    };
    assert!(platform::checked_executable(&item).is_ok());
    fs::write(&path, b"modified").unwrap();
    assert!(platform::checked_executable(&item).is_err());
    platform::uninstall(&item).unwrap();
    assert!(!path.exists());
    assert_eq!(fs::read_to_string(project).unwrap(), "project data");
}

#[cfg(target_os = "linux")]
#[test]
fn symlinks_and_unowned_directories_cannot_be_used_as_installations() {
    use std::os::unix::fs::symlink;
    let temp = TempDir::new().unwrap();
    let root = temp.path().join("apps");
    let elsewhere = temp.path().join("elsewhere");
    fs::create_dir_all(&root).unwrap();
    fs::create_dir_all(&elsewhere).unwrap();
    symlink(&elsewhere, root.join("consolostruct")).unwrap();
    assert!(storage::managed_app_dir(&root, "consolostruct").is_err());
    fs::remove_file(root.join("consolostruct")).unwrap();
    fs::create_dir(root.join("consolostruct")).unwrap();
    let source = temp.path().join("source");
    fs::write(&source, "not an appimage").unwrap();
    assert!(platform::install(&source, &root, &catalog().apps[0], "1.0.0", &asset()).is_err());
    assert!(elsewhere.exists());
}
