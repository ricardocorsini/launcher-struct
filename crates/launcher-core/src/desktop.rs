//! Per-user Linux menu integration. AppImages remain at their installed paths.
use crate::model::{valid_id, Installed};
use crate::platform::checked_executable;
use crate::storage::reject_symlink;
use anyhow::{ensure, Context, Result};
use std::fs;
use std::io::{Read, Write};
use std::os::unix::fs::PermissionsExt;
use std::path::{Path, PathBuf};

const LAUNCHER_ICON: &[u8] = include_bytes!("../../../public/assets/desktop/launcher.png");

fn identity(id: &str) -> (String, &str, &[u8]) {
    match id {
        // Keep the native binary identities: existing projects and installations stay compatible.
        "molastruct" => (
            "molasstruct.desktop".into(),
            "molasstruct",
            include_bytes!("../../../public/assets/desktop/molastruct.png"),
        ),
        "consolostruct" => (
            "consolostruct.desktop".into(),
            "consolostruct",
            include_bytes!("../../../public/assets/desktop/consolostruct.png"),
        ),
        "armadurastruct" => (
            "armadurastruct.desktop".into(),
            "armadurastruct",
            include_bytes!("../../../public/assets/desktop/armadurastruct.png"),
        ),
        _ => (format!("openstruct-{id}.desktop"), id, LAUNCHER_ICON),
    }
}

fn text_path(path: &Path) -> Result<&str> {
    let value = path
        .to_str()
        .context("O caminho do atalho precisa ser UTF-8")?;
    ensure!(
        !value.chars().any(char::is_control),
        "Caminho de atalho inválido"
    );
    Ok(value)
}

fn value(text: &str) -> String {
    text.replace('\\', "\\\\").replace(' ', "\\s")
}

fn exec(path: &Path) -> Result<String> {
    let path = text_path(path)?;
    ensure!(
        !path.contains('='),
        "O menu Linux não aceita = no caminho do executável"
    );
    // Desktop Entry string escaping is applied before Exec argument escaping.
    // The fixed env executable also lets GLib launch filenames containing literal %.
    let mut quoted = String::new();
    for c in path.chars() {
        if matches!(c, '\\' | '"' | '`' | '$') {
            quoted.push('\\');
        }
        quoted.push(c);
        if c == '%' {
            quoted.push('%');
        }
    }
    Ok(format!("\"{}\"", quoted.replace('\\', "\\\\")))
}

fn owned(path: &Path, id: &str, root: Option<&str>) -> bool {
    fs::read_to_string(path)
        .map(|text| {
            text.lines().any(|l| l == "X-OpenStruct-Managed=true")
                && root
                    .map(|root| {
                        text.lines()
                            .any(|l| l == format!("X-OpenStruct-Root={}", value(root)))
                    })
                    .unwrap_or_else(|| {
                        text.lines()
                            .any(|l| l == format!("X-OpenStruct-AppId={id}"))
                    })
        })
        .unwrap_or(false)
}

fn atomic_file(path: &Path, bytes: &[u8]) -> Result<()> {
    reject_symlink(path)?;
    let parent = path.parent().context("Pasta do atalho inválida")?;
    fs::create_dir_all(parent)?;
    let mut temp = tempfile::NamedTempFile::new_in(parent)?;
    temp.write_all(bytes)?;
    temp.as_file().sync_all()?;
    fs::set_permissions(temp.path(), fs::Permissions::from_mode(0o644))?;
    temp.persist(path).map_err(|e| e.error)?;
    Ok(())
}

pub(crate) fn write_app_shortcut(data: &Path, item: &Installed) -> Result<PathBuf> {
    ensure!(
        valid_id(&item.app_id),
        "Identificador de aplicativo inválido"
    );
    checked_executable(item)?;
    let (filename, wm_class, artwork) = identity(&item.app_id);
    let desktop = data.join("applications").join(filename);
    reject_symlink(&desktop)?;
    ensure!(
        !desktop.exists() || owned(&desktop, &item.app_id, Some(&item.root)),
        "Já existe um atalho criado fora do launcher"
    );
    let icon = Path::new(&item.root).join(&item.app_id).join("icon.png");
    let name = match item.app_id.as_str() {
        "molastruct" => "MolaStruct",
        "consolostruct" => "ConsoloStruct",
        "armadurastruct" => "ArmaduraStruct",
        _ => &item.name,
    };
    ensure!(
        !name.chars().any(char::is_control),
        "Nome do aplicativo inválido"
    );
    let command = exec(Path::new(&item.executable))?;
    let icon_path = value(text_path(&icon)?);
    let root = value(text_path(Path::new(&item.root))?);
    let content = format!("[Desktop Entry]\nType=Application\nName={}\nExec=/usr/bin/env -- {command}\nTryExec={}\nIcon={icon_path}\nTerminal=false\nCategories=Education;Science;Engineering;\nStartupWMClass={wm_class}\nX-OpenStruct-Managed=true\nX-OpenStruct-AppId={}\nX-OpenStruct-Root={root}\n", value(name), value(&item.executable), item.app_id);
    atomic_file(&icon, artwork)?;
    atomic_file(&desktop, content.as_bytes())?;
    let legacy = data
        .join("applications")
        .join(format!("openstruct-{}.desktop", item.app_id));
    if legacy != desktop && owned_legacy(&legacy, item) {
        reject_symlink(&legacy)?;
        fs::remove_file(legacy)?;
    }
    Ok(desktop)
}

fn owned_legacy(path: &Path, item: &Installed) -> bool {
    // The old writer did not escape spaces/backslashes in its custom root value.
    fs::read_to_string(path)
        .map(|text| {
            text.lines().any(|l| l == "X-OpenStruct-Managed=true")
                && text
                    .lines()
                    .any(|l| l == format!("X-OpenStruct-Root={}", item.root))
        })
        .unwrap_or(false)
}

pub(crate) fn remove_app_shortcut(data: &Path, item: &Installed) -> Result<()> {
    for (path, legacy) in [
        (
            data.join("applications").join(identity(&item.app_id).0),
            false,
        ),
        (
            data.join("applications")
                .join(format!("openstruct-{}.desktop", item.app_id)),
            true,
        ),
    ] {
        if owned(&path, &item.app_id, Some(&item.root)) || (legacy && owned_legacy(&path, item)) {
            reject_symlink(&path)?;
            fs::remove_file(path)?;
        }
    }
    Ok(())
}

pub(crate) fn register_launcher(data: &Path, appimage: &Path) -> Result<PathBuf> {
    let appimage = appimage
        .canonicalize()
        .context("AppImage do launcher não encontrado")?;
    let mut header = [0; 11];
    fs::File::open(&appimage)?.read_exact(&mut header)?;
    ensure!(
        &header[..4] == b"\x7fELF" && &header[8..11] == b"AI\x02",
        "Executável do launcher não é um AppImage tipo 2"
    );
    let desktop = data.join("applications/com.openstruct.launcher.desktop");
    reject_symlink(&desktop)?;
    ensure!(
        !desktop.exists() || owned(&desktop, "launcher", None),
        "O atalho do launcher já existe e não é gerenciado pela OpenStruct"
    );
    let icon = data.join("icons/hicolor/256x256/apps/com.openstruct.launcher.png");
    let command = exec(&appimage)?;
    let content = format!("[Desktop Entry]\nType=Application\nName=Struct Launcher\nComment=Aplicativos de engenharia OpenStruct\nExec=/usr/bin/env -- {command}\nTryExec={}\nIcon={}\nTerminal=false\nCategories=Education;Science;Engineering;\nStartupWMClass=struct-launcher\nX-OpenStruct-Managed=true\nX-OpenStruct-AppId=launcher\n", value(text_path(&appimage)?), value(text_path(&icon)?));
    atomic_file(&icon, LAUNCHER_ICON)?;
    atomic_file(&desktop, content.as_bytes())?;
    Ok(desktop)
}

#[cfg(test)]
mod tests;
