use super::*;
use crate::storage::{atomic_json, digest};
use tempfile::TempDir;

fn installed(temp: &TempDir, id: &str) -> Installed {
    let root = temp.path().join("Aplicativos ç # 100% $ ` quote\" slash\\");
    let app = root.join(id);
    fs::create_dir_all(&app).unwrap();
    atomic_json(
        &app.join(".openstruct-managed.json"),
        &serde_json::json!({"appId":id}),
    )
    .unwrap();
    let executable = app.join("0.5.0/app.AppImage");
    fs::create_dir_all(executable.parent().unwrap()).unwrap();
    fs::write(&executable, b"\x7fELF0000AI\x02test").unwrap();
    Installed {
        app_id: id.into(),
        name: "MolasStruct".into(),
        version: "0.5.0".into(),
        kind: "appimage".into(),
        root: root.to_str().unwrap().into(),
        executable: executable.to_str().unwrap().into(),
        executable_sha256: digest(&executable).unwrap(),
        installed_at: "2026-11-06T00:00:00Z".into(),
        present: true,
        modified: false,
        previous_version: None,
    }
}

fn validate(path: &Path) {
    match std::process::Command::new("desktop-file-validate")
        .arg(path)
        .output()
    {
        Ok(output) => assert!(
            output.status.success(),
            "{}",
            String::from_utf8_lossy(&output.stderr)
        ),
        Err(error) => assert_eq!(error.kind(), std::io::ErrorKind::NotFound),
    }
}

#[test]
fn existing_mola_gets_its_own_artwork_name_and_native_window_identity() {
    let temp = TempDir::new().unwrap();
    let data = temp.path().join("data");
    let item = installed(&temp, "molastruct");
    let legacy = data.join("applications/openstruct-molastruct.desktop");
    fs::create_dir_all(legacy.parent().unwrap()).unwrap();
    fs::write(
        &legacy,
        format!(
            "[Desktop Entry]\nX-OpenStruct-Managed=true\nX-OpenStruct-Root={}\n",
            item.root
        ),
    )
    .unwrap();
    let desktop = write_app_shortcut(&data, &item).unwrap();
    assert_eq!(desktop.file_name().unwrap(), "molasstruct.desktop");
    let text = fs::read_to_string(&desktop).unwrap();
    assert!(text.contains("Name=MolaStruct\n"));
    assert!(text.contains("StartupWMClass=molasstruct\n"));
    assert!(text.contains("100%%"));
    assert!(!legacy.exists());
    let png = fs::read(Path::new(&item.root).join("molastruct/icon.png")).unwrap();
    assert_eq!(png, identity("molastruct").2);
    assert_ne!(png, LAUNCHER_ICON);
    validate(&desktop);
    assert_eq!(write_app_shortcut(&data, &item).unwrap(), desktop);
    remove_app_shortcut(&data, &item).unwrap();
    assert!(!desktop.exists());
}

#[test]
fn each_known_product_has_distinct_artwork_and_unowned_shortcuts_are_preserved() {
    assert_ne!(identity("molastruct").2, identity("consolostruct").2);
    let temp = TempDir::new().unwrap();
    let data = temp.path().join("data");
    let item = installed(&temp, "consolostruct");
    let path = data.join("applications/consolostruct.desktop");
    fs::create_dir_all(path.parent().unwrap()).unwrap();
    fs::write(&path, "[Desktop Entry]\nName=My shortcut\n").unwrap();
    assert!(write_app_shortcut(&data, &item).is_err());
    remove_app_shortcut(&data, &item).unwrap();
    assert_eq!(
        fs::read_to_string(path).unwrap(),
        "[Desktop Entry]\nName=My shortcut\n"
    );
}

#[test]
fn geospt_migrates_its_managed_shortcut_with_native_identity_and_own_artwork() {
    let temp = TempDir::new().unwrap();
    let data = temp.path().join("menu");
    let mut item = installed(&temp, "geosptstruct");
    item.name = "GeoSPT".into();
    let legacy = data.join("applications/openstruct-geosptstruct.desktop");
    fs::create_dir_all(legacy.parent().unwrap()).unwrap();
    fs::write(
        &legacy,
        format!(
            "[Desktop Entry]\nX-OpenStruct-Managed=true\nX-OpenStruct-Root={}\n",
            item.root
        ),
    )
    .unwrap();
    let executable_hash = digest(Path::new(&item.executable)).unwrap();
    let desktop = write_app_shortcut(&data, &item).unwrap();
    assert_eq!(desktop.file_name().unwrap(), "geosptstruct.desktop");
    let text = fs::read_to_string(&desktop).unwrap();
    assert!(text.contains("Name=GeoSPT\n"));
    assert!(text.contains("StartupWMClass=geosptstruct\n"));
    assert!(!legacy.exists());
    let png = fs::read(Path::new(&item.root).join("geosptstruct/icon.png")).unwrap();
    assert_eq!(png, identity("geosptstruct").2);
    for other in ["launcher", "consolostruct", "molastruct", "armadurastruct"] {
        assert_ne!(png, identity(other).2);
    }
    assert_eq!(
        digest(Path::new(&item.executable)).unwrap(),
        executable_hash
    );
    validate(&desktop);
    assert_eq!(write_app_shortcut(&data, &item).unwrap(), desktop);
    remove_app_shortcut(&data, &item).unwrap();
    assert!(!desktop.exists());
}

#[test]
fn armadura_migrates_the_generic_shortcut_to_its_native_identity_and_artwork() {
    let temp = TempDir::new().unwrap();
    let data = temp.path().join("data");
    let item = installed(&temp, "armadurastruct");
    let legacy = data.join("applications/openstruct-armadurastruct.desktop");
    fs::create_dir_all(legacy.parent().unwrap()).unwrap();
    fs::write(
        &legacy,
        format!(
            "[Desktop Entry]\nX-OpenStruct-Managed=true\nX-OpenStruct-Root={}\n",
            item.root
        ),
    )
    .unwrap();
    let desktop = write_app_shortcut(&data, &item).unwrap();
    assert_eq!(desktop.file_name().unwrap(), "armadurastruct.desktop");
    let text = fs::read_to_string(&desktop).unwrap();
    assert!(text.contains("Name=ArmaduraStruct\n"));
    assert!(text.contains("StartupWMClass=armadurastruct\n"));
    assert!(!legacy.exists());
    let png = fs::read(Path::new(&item.root).join("armadurastruct/icon.png")).unwrap();
    assert_eq!(png, identity("armadurastruct").2);
    for other in ["launcher", "molastruct", "consolostruct"] {
        assert_ne!(png, identity(other).2);
    }
    validate(&desktop);
    assert_eq!(write_app_shortcut(&data, &item).unwrap(), desktop);
    remove_app_shortcut(&data, &item).unwrap();
    assert!(!desktop.exists());
}

#[test]
fn shortcut_does_not_trust_a_changed_executable_or_follow_icon_symlinks() {
    use std::os::unix::fs::symlink;
    let temp = TempDir::new().unwrap();
    let data = temp.path().join("data");
    let item = installed(&temp, "molastruct");
    let outside = temp.path().join("outside.png");
    fs::write(&outside, b"unchanged").unwrap();
    let icon = Path::new(&item.root).join("molastruct/icon.png");
    symlink(&outside, &icon).unwrap();
    assert!(write_app_shortcut(&data, &item).is_err());
    assert_eq!(fs::read(&outside).unwrap(), b"unchanged");
    fs::remove_file(icon).unwrap();
    fs::write(&item.executable, b"changed").unwrap();
    assert!(write_app_shortcut(&data, &item).is_err());
    assert!(!data.join("applications/molasstruct.desktop").exists());
}

#[test]
fn launcher_registers_itself_and_updates_the_path_after_the_appimage_moves() {
    let temp = TempDir::new().unwrap();
    let item = installed(&temp, "launcher");
    let data = temp.path().join("data");
    let desktop = register_launcher(&data, Path::new(&item.executable)).unwrap();
    validate(&desktop);
    assert!(fs::read_to_string(&desktop)
        .unwrap()
        .contains("Name=Struct Launcher\n"));
    assert_eq!(
        fs::read(data.join("icons/hicolor/256x256/apps/com.openstruct.launcher.png")).unwrap(),
        LAUNCHER_ICON
    );
    let moved = temp.path().join("launcher-updated.AppImage");
    fs::rename(&item.executable, &moved).unwrap();
    register_launcher(&data, &moved).unwrap();
    assert!(fs::read_to_string(&desktop)
        .unwrap()
        .contains(&exec(&moved).unwrap()));
    fs::write(&desktop, "[Desktop Entry]\nName=User launcher\n").unwrap();
    assert!(register_launcher(&data, &moved).is_err());
    fs::write(&moved, b"not an AppImage").unwrap();
    assert!(register_launcher(&data, &moved).is_err());
}

#[test]
fn exec_escapes_both_desktop_string_and_argument_layers_and_rejects_injection() {
    assert_eq!(
        exec(Path::new(r#"/tmp/á 100% $ ` " \ .AppImage"#)).unwrap(),
        r#""/tmp/á 100%% \\$ \\` \\" \\\\ .AppImage""#
    );
    assert!(exec(Path::new("/tmp/app\nName=Other")).is_err());
    assert!(exec(Path::new("/tmp/app=other")).is_err());
}

#[test]
fn startup_repairs_existing_installs_and_skips_modified_executables() {
    use crate::Engine;
    use std::collections::BTreeMap;
    let temp = TempDir::new().unwrap();
    let data = temp.path().join("state");
    let menu = temp.path().join("menu");
    let mola = installed(&temp, "molastruct");
    let consolo = installed(&temp, "consolostruct");
    let engine = Engine::open(data.clone()).unwrap();
    let settings = engine.snapshot().settings;
    drop(engine);
    atomic_json(
        &data.join("state.json"),
        &crate::DiskState {
            schema_version: 1,
            settings,
            inventory: BTreeMap::from([
                (mola.app_id.clone(), mola),
                (consolo.app_id.clone(), consolo.clone()),
            ]),
            jobs: vec![],
        },
    )
    .unwrap();
    fs::write(&consolo.executable, b"changed after installation").unwrap();
    let engine = Engine::open(data).unwrap();
    engine.integrate_desktop_in(&menu, None).unwrap();
    assert_eq!(engine.snapshot().inventory["molastruct"].name, "MolaStruct");
    assert!(menu.join("applications/molasstruct.desktop").exists());
    assert!(!menu.join("applications/consolostruct.desktop").exists());
    assert!(engine.snapshot().inventory["consolostruct"].modified);
}

#[test]
fn glib_launches_the_exact_executable_path_with_spaces_unicode_and_reserved_characters() {
    if std::process::Command::new("gio")
        .arg("version")
        .output()
        .is_err()
    {
        return;
    }
    let temp = TempDir::new().unwrap();
    let mut item = installed(&temp, "molastruct");
    let receipt = temp.path().join("executed-path.txt");
    fs::write(
        &item.executable,
        format!("#!/bin/sh\nprintf '%s' \"$0\" > '{}'\n", receipt.display()),
    )
    .unwrap();
    fs::set_permissions(&item.executable, fs::Permissions::from_mode(0o755)).unwrap();
    item.executable_sha256 = digest(Path::new(&item.executable)).unwrap();
    let desktop = write_app_shortcut(&temp.path().join("menu"), &item).unwrap();
    let output = std::process::Command::new("gio")
        .arg("launch")
        .arg(desktop)
        .output()
        .unwrap();
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    for _ in 0..100 {
        if receipt.exists() {
            break;
        }
        std::thread::sleep(std::time::Duration::from_millis(10));
    }
    assert_eq!(fs::read_to_string(receipt).unwrap(), item.executable);
}
