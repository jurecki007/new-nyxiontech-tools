fn main() {
    // tauri.conf.json takes the app version from package.json. Cargo doesn't know
    // that, so without this a version bump alone keeps the old version in the exe's
    // file properties (and in the app config) until something else triggers a rebuild.
    println!("cargo:rerun-if-changed=../package.json");
    tauri_build::build()
}
