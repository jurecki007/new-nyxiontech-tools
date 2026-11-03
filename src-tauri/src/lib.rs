use std::path::Path;

use tauri::ipc::{InvokeBody, Request};
use tauri::{Url, WebviewWindow};
use tauri_plugin_dialog::DialogExt;

/// Saves a file the app produced. The page sends the bytes as the raw request
/// body and the suggested name in the `x-file-name` header (URI-encoded); the
/// user picks the location in a native "Save as" dialog. This is the only way
/// the page can write to disk: it gets no general file-system access.
/// Returns false when the user cancels.
#[tauri::command]
async fn save_file(window: WebviewWindow, request: Request<'_>) -> Result<bool, String> {
    let InvokeBody::Raw(bytes) = request.body() else {
        return Err("expected the file contents as a raw body".into());
    };
    let name = request
        .headers()
        .get("x-file-name")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| percent_encoding::percent_decode_str(v).decode_utf8().ok())
        .map(|v| v.into_owned())
        .unwrap_or_else(|| "document".into());

    let mut dialog = window
        .dialog()
        .file()
        .set_parent(&window)
        .set_file_name(&name);
    if let Some(ext) = Path::new(&name).extension().and_then(|e| e.to_str()) {
        dialog = dialog.add_filter(ext.to_uppercase(), &[ext]);
    }
    let Some(target) = dialog.blocking_save_file() else {
        return Ok(false);
    };
    let path = target.into_path().map_err(|e| e.to_string())?;
    std::fs::write(&path, bytes).map_err(|e| format!("Could not save {}: {e}", path.display()))?;
    Ok(true)
}

/// The app's own pages: the bundled build in release, the Vite dev server in development.
fn is_app_url(url: &Url) -> bool {
    match url.scheme() {
        "tauri" => true,
        "http" | "https" => match url.host_str() {
            Some("tauri.localhost") => true,
            Some("localhost") => cfg!(debug_assertions),
            _ => false,
        },
        "about" | "blob" | "data" => true,
        _ => false,
    }
}

/// Keeps the window on the app: links to websites or e-mail (e.g. in a Word
/// document preview) open in the user's default browser or mail client instead.
fn navigation_guard() -> tauri::plugin::TauriPlugin<tauri::Wry> {
    tauri::plugin::Builder::new("navigation-guard")
        .on_navigation(|_, url| {
            if is_app_url(url) {
                return true;
            }
            if matches!(url.scheme(), "http" | "https" | "mailto") {
                let _ = tauri_plugin_opener::open_url(url.as_str(), None::<&str>);
            }
            false
        })
        .build()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(navigation_guard())
        .invoke_handler(tauri::generate_handler![save_file])
        .run(tauri::generate_context!())
        .expect("error while running the application");
}
