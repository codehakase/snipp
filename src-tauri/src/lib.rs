use tauri::{AppHandle, Emitter};
use tauri_plugin_shell::ShellExt;
use std::path::PathBuf;

#[tauri::command]
async fn capture_screenshot(app_handle: AppHandle) -> Result<String, String> {
    let home_dir = std::env::var("HOME").map_err(|_| "Failed to get home directory")?;
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs();
    
    let filename = format!("snipp-{}.png", timestamp);
    let file_path = PathBuf::from(&home_dir).join("Desktop").join(&filename);
    
    let shell = app_handle.shell();
    let output = shell
        .command("screencapture")
        .args(["-i", file_path.to_str().unwrap()])
        .output()
        .await
        .map_err(|e| format!("Failed to execute screencapture: {}", e))?;
    
    if output.status.success() {
        app_handle.emit("screenshot-captured", &file_path.to_string_lossy().to_string())
            .map_err(|e| format!("Failed to emit event: {}", e))?;
        Ok(file_path.to_string_lossy().to_string())
    } else {
        Err("Screenshot capture was cancelled or failed".to_string())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![capture_screenshot])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
