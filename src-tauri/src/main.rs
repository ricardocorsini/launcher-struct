#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use launcher_core::{Engine, Settings, Snapshot};
use serde::Serialize;
use std::sync::Arc;
use tauri::{Emitter, Manager, State};
use tauri_plugin_opener::OpenerExt;
use tauri_plugin_updater::UpdaterExt;

struct LauncherState(Arc<Engine>);
type ApiResult<T> = Result<T, String>;
fn error(e: impl std::fmt::Display) -> String {
    e.to_string()
}

#[tauri::command]
async fn get_snapshot(state: State<'_, LauncherState>) -> ApiResult<Snapshot> {
    let engine = state.0.clone();
    tauri::async_runtime::spawn_blocking(move || engine.reconcile())
        .await
        .map_err(error)?
        .map_err(error)
}

#[tauri::command]
async fn refresh_catalog(state: State<'_, LauncherState>) -> ApiResult<Snapshot> {
    state.0.refresh_catalog().await.map_err(error)
}

#[tauri::command]
fn save_settings(settings: Settings, state: State<'_, LauncherState>) -> ApiResult<Snapshot> {
    state.0.save_settings(settings).map_err(error)
}

#[tauri::command]
fn install_app(
    app_id: String,
    version: String,
    allow_downgrade: bool,
    state: State<'_, LauncherState>,
) -> ApiResult<Snapshot> {
    let snapshot = state
        .0
        .enqueue(&app_id, &version, allow_downgrade)
        .map_err(error)?;
    let engine = state.0.clone();
    tauri::async_runtime::spawn(async move {
        engine.process_queue().await;
    });
    Ok(snapshot)
}

#[tauri::command]
fn cancel_job(job_id: String, state: State<'_, LauncherState>) -> ApiResult<Snapshot> {
    state.0.cancel_job(&job_id).map_err(error)
}

#[tauri::command]
fn clear_history(state: State<'_, LauncherState>) -> ApiResult<Snapshot> {
    state.0.clear_history().map_err(error)
}

#[tauri::command]
async fn launch_app(app_id: String, state: State<'_, LauncherState>) -> ApiResult<Snapshot> {
    let engine = state.0.clone();
    tauri::async_runtime::spawn_blocking(move || engine.launch(&app_id))
        .await
        .map_err(error)?
        .map_err(error)
}

#[tauri::command]
async fn uninstall_app(app_id: String, state: State<'_, LauncherState>) -> ApiResult<Snapshot> {
    let engine = state.0.clone();
    tauri::async_runtime::spawn_blocking(move || engine.uninstall(&app_id))
        .await
        .map_err(error)?
        .map_err(error)
}

#[tauri::command]
fn open_product_link(
    app_id: String,
    kind: String,
    app: tauri::AppHandle,
    state: State<'_, LauncherState>,
) -> ApiResult<()> {
    let link = state.0.product_link(&app_id, &kind).map_err(error)?;
    app.opener().open_url(link, None::<&str>).map_err(error)
}

#[tauri::command]
fn open_project_link(kind: String, app: tauri::AppHandle) -> ApiResult<()> {
    let link = match kind.as_str() {
        "website" => "https://openstruct.com.br",
        "repository" => "https://github.com/ricardocorsini/launcher-struct",
        "help" => {
            "https://github.com/ricardocorsini/launcher-struct/blob/master/docs/GUIA-DE-USO.md"
        }
        _ => return Err("Endereço desconhecido".into()),
    };
    app.opener().open_url(link, None::<&str>).map_err(error)
}

#[tauri::command]
fn open_app_folder(
    app_id: String,
    app: tauri::AppHandle,
    state: State<'_, LauncherState>,
) -> ApiResult<()> {
    let path = state.0.app_folder(&app_id).map_err(error)?;
    app.opener()
        .open_path(path.to_string_lossy(), None::<&str>)
        .map_err(error)
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct UpdateInfo {
    configured: bool,
    version: Option<String>,
    notes: Option<String>,
}

fn update_config() -> Option<(&'static str, &'static str)> {
    #[cfg(target_os = "linux")]
    if std::env::var_os("APPIMAGE").is_none() {
        return None;
    }
    Some((
        option_env!("STRUCT_LAUNCHER_UPDATE_URL").filter(|v| !v.is_empty())?,
        option_env!("STRUCT_LAUNCHER_UPDATE_PUBKEY").filter(|v| !v.is_empty())?,
    ))
}

#[tauri::command]
async fn check_launcher_update(app: tauri::AppHandle) -> ApiResult<UpdateInfo> {
    let Some((url, key)) = update_config() else {
        return Ok(UpdateInfo {
            configured: false,
            version: None,
            notes: None,
        });
    };
    launcher_core::model::validate_https(url).map_err(error)?;
    let update = app
        .updater_builder()
        .pubkey(key)
        .endpoints(vec![url.parse::<url::Url>().map_err(error)?])
        .map_err(error)?
        .build()
        .map_err(error)?
        .check()
        .await
        .map_err(error)?;
    Ok(UpdateInfo {
        configured: true,
        version: update.as_ref().map(|u| u.version.clone()),
        notes: update.and_then(|u| u.body),
    })
}

#[tauri::command]
async fn install_launcher_update(
    version: String,
    app: tauri::AppHandle,
    state: State<'_, LauncherState>,
) -> ApiResult<()> {
    let snapshot = state.0.snapshot();
    if snapshot
        .jobs
        .iter()
        .any(|j| launcher_core::model::is_active(&j.phase))
    {
        return Err("Aguarde os downloads terminarem antes de reiniciar o launcher".into());
    }
    let (url, key) = update_config().ok_or("Atualização do launcher ainda não configurada")?;
    launcher_core::model::validate_https(url).map_err(error)?;
    let update = app
        .updater_builder()
        .pubkey(key)
        .endpoints(vec![url.parse::<url::Url>().map_err(error)?])
        .map_err(error)?
        .build()
        .map_err(error)?
        .check()
        .await
        .map_err(error)?
        .ok_or("Não há atualização disponível")?;
    if update.version != version {
        return Err("A versão disponível mudou. Verifique novamente".into());
    }
    update
        .download_and_install(|_, _| {}, || {})
        .await
        .map_err(error)?;
    app.restart();
}

#[tauri::command]
fn quit_launcher(
    confirmed: bool,
    app: tauri::AppHandle,
    state: State<'_, LauncherState>,
) -> ApiResult<()> {
    let snapshot = state.0.snapshot();
    if snapshot.jobs.iter().any(|j| j.phase == "installing") {
        return Err("Aguarde a instalação terminar antes de sair".into());
    }
    if snapshot
        .jobs
        .iter()
        .any(|j| launcher_core::model::is_active(&j.phase))
        && !confirmed
    {
        return Err("Confirme a interrupção dos downloads".into());
    }
    app.exit(0);
    Ok(())
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            let engine = Engine::open(app.path().app_data_dir()?)?;
            let handle = app.handle().clone();
            engine.set_sink(Arc::new(move |snapshot| {
                let _ = handle.emit("launcher-state", snapshot);
            }));
            app.manage(LauncherState(engine));
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                if let Some(state) = window.try_state::<LauncherState>() {
                    if state
                        .0
                        .snapshot()
                        .jobs
                        .iter()
                        .any(|j| launcher_core::model::is_active(&j.phase))
                    {
                        api.prevent_close();
                        let _ = window.emit("launcher-close-requested", ());
                    }
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            quit_launcher,
            get_snapshot,
            refresh_catalog,
            save_settings,
            install_app,
            cancel_job,
            clear_history,
            launch_app,
            uninstall_app,
            open_product_link,
            open_project_link,
            open_app_folder,
            check_launcher_update,
            install_launcher_update
        ])
        .run(tauri::generate_context!())
        .expect("Não foi possível iniciar o Struct Launcher");
}
