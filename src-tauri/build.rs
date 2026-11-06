fn main() {
    println!("cargo:rerun-if-env-changed=STRUCT_LAUNCHER_UPDATE_PUBKEY");
    println!("cargo:rerun-if-env-changed=STRUCT_LAUNCHER_UPDATE_URL");
    tauri_build::build()
}
