use tauri::{AppHandle, Emitter, Manager, State, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_shell::ShellExt;
use tauri_plugin_dialog::DialogExt;
use std::path::PathBuf;
use std::sync::Mutex;
use std::collections::HashMap;

#[cfg(target_os = "macos")]
use cocoa::appkit::NSEvent;
#[cfg(target_os = "macos")]
use cocoa::foundation::{NSPoint, NSAutoreleasePool};

// Global storage for screenshot data in memory
type ScreenshotCache = Mutex<HashMap<String, Vec<u8>>>;
static SCREENSHOT_CACHE: std::sync::OnceLock<ScreenshotCache> = std::sync::OnceLock::new();

mod config;
use config::{AppConfig, ConfigManager};

type ConfigState = Mutex<ConfigManager>;

#[derive(Debug, serde::Serialize, serde::Deserialize, Clone)]
pub struct ScreenshotData {
    pub base64_image: String,
    pub filename: String,
    pub timestamp: u64,
    pub file_path: Option<String>, // Only set when saved to disk
}

#[tauri::command]
async fn capture_screenshot(
    app_handle: AppHandle,
    config_state: State<'_, ConfigState>,
) -> Result<ScreenshotData, String> {
    println!("Starting memory-first screenshot capture...");
    
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs();
    
    let filename = format!("snipp-{}.png", timestamp);
    
    // Capture screenshot to temporary file then read into memory
    let temp_path = std::env::temp_dir().join(format!("snipp_capture_{}.png", timestamp));
    
    let shell = app_handle.shell();
    let output = shell
        .command("screencapture")
        .args(["-i", "-t", "png", temp_path.to_string_lossy().as_ref()])
        .output()
        .await
        .map_err(|e| format!("Failed to execute screencapture: {}", e))?;
    
    if !output.status.success() {
        // Clean up temp file if command failed
        let _ = std::fs::remove_file(&temp_path);
        return Err("Screenshot capture was cancelled or failed".to_string());
    }
    
    // Read the captured file into memory
    let image_data = std::fs::read(&temp_path)
        .map_err(|e| format!("Failed to read captured screenshot: {}", e))?;
    
    // Clean up temp file
    let _ = std::fs::remove_file(&temp_path);
    
    if image_data.is_empty() {
        return Err("No image data captured".to_string());
    }
    
    println!("Captured {} bytes of image data", image_data.len());
    
    // Convert to base64 for web display
    let base64_image = base64::encode(&image_data);
    
    // Store in memory cache for later operations
    let cache_key = timestamp.to_string();
    let cache = SCREENSHOT_CACHE.get_or_init(|| Mutex::new(HashMap::new()));
    {
        let mut cache_guard = cache.lock().unwrap();
        cache_guard.insert(cache_key.clone(), image_data);
        println!("Stored image in memory cache with key: {}", cache_key);
    }
    
    let screenshot_data = ScreenshotData {
        base64_image,
        filename: filename.clone(),
        timestamp,
        file_path: None, // Will be set when/if saved to disk
    };
    
    // Show the popup window with image data
    show_popup_window(&app_handle, &screenshot_data).await?;
    
    Ok(screenshot_data)
}

async fn show_popup_window(app_handle: &AppHandle, screenshot_data: &ScreenshotData) -> Result<(), String> {
    println!("Creating popup window for screenshot: {}", screenshot_data.filename);
    
    // Get cursor position for popup placement
    let cursor_pos = get_cursor_position();
    println!("Cursor position: {:?}", cursor_pos);
    
    let popup_window = WebviewWindowBuilder::new(
        app_handle,
        "popup",
        WebviewUrl::App("popup.html".into())
    )
    .title("Screenshot Captured")
    .inner_size(320.0, 300.0)
    .decorations(false)
    .transparent(true)
    .always_on_top(true)
    .skip_taskbar(true)
    .resizable(false)
    .minimizable(false)
    .maximizable(false)
    .build()
    .map_err(|e| format!("Failed to create popup window: {}", e))?;
    
    println!("Popup window created successfully");
    
    // Position the popup near cursor with bounds checking
    let x = cursor_pos.0.max(0.0).min(1920.0 - 320.0); // Basic bounds check
    let y = (cursor_pos.1 + 40.0).max(0.0).min(1080.0 - 300.0);
    
    popup_window.set_position(tauri::Position::Physical(tauri::PhysicalPosition { x: x as i32, y: y as i32 }))
        .map_err(|e| format!("Failed to position popup: {}", e))?;
    
    // Give the popup window time to load before emitting the event
    println!("Waiting 200ms for popup to load...");
    tokio::time::sleep(tokio::time::Duration::from_millis(200)).await;
    
    // Send screenshot data directly to the popup
    println!("Emitting screenshot-data event to popup");
    popup_window.emit("screenshot-data", screenshot_data)
        .map_err(|e| format!("Failed to emit screenshot data: {}", e))?;
    
    println!("Event emitted successfully");
    
    Ok(())
}

#[cfg(target_os = "macos")]
fn get_cursor_position() -> (f64, f64) {
    unsafe {
        let _pool = NSAutoreleasePool::new(cocoa::base::nil);
        let mouse_location = NSEvent::mouseLocation(cocoa::base::nil);
        
        // Get screen height to convert coordinate system
        let screen = cocoa::appkit::NSScreen::mainScreen(cocoa::base::nil);
        let screen_frame = cocoa::appkit::NSScreen::frame(screen);
        let screen_height = screen_frame.size.height;
        
        // Convert from Cocoa coordinates (bottom-left origin) to screen coordinates (top-left origin)
        (mouse_location.x, screen_height - mouse_location.y)
    }
}

#[cfg(not(target_os = "macos"))]
fn get_cursor_position() -> (f64, f64) {
    // Fallback for non-macOS platforms
    (600.0, 400.0)
}

#[tauri::command]
async fn copy_to_clipboard(
    _app_handle: AppHandle,
    timestamp: u64,
) -> Result<(), String> {
    println!("Copying screenshot to clipboard from memory cache: {}", timestamp);
    
    // Get image data from memory cache
    let cache_key = timestamp.to_string();
    let image_data = {
        let cache = SCREENSHOT_CACHE.get_or_init(|| Mutex::new(HashMap::new()));
        let cache_guard = cache.lock().unwrap();
        cache_guard.get(&cache_key).cloned()
    };
    
    let image_data = image_data.ok_or("Screenshot data not found in memory cache")?;
    
    // Write image data to temporary file for clipboard operation
    let temp_path = std::env::temp_dir().join(format!("snipp_temp_{}.png", timestamp));
    std::fs::write(&temp_path, &image_data)
        .map_err(|e| format!("Failed to write temp file: {}", e))?;
    
    // Copy to clipboard using the temp file
    let shell_command = format!("osascript -e 'set the clipboard to (read (POSIX file \"{}\") as JPEG picture)'", temp_path.to_string_lossy());
    
    let output = std::process::Command::new("sh")
        .arg("-c")
        .arg(&shell_command)
        .output()
        .map_err(|e| format!("Failed to execute clipboard command: {}", e))?;
    
    // Clean up temp file
    let _ = std::fs::remove_file(&temp_path);
    
    if output.status.success() {
        println!("Successfully copied screenshot to clipboard");
        Ok(())
    } else {
        let error = String::from_utf8_lossy(&output.stderr);
        Err(format!("Clipboard operation failed: {}", error))
    }
}

#[tauri::command]
async fn save_to_disk(
    timestamp: u64,
    config_state: State<'_, ConfigState>,
) -> Result<String, String> {
    println!("Saving screenshot to disk from memory cache: {}", timestamp);
    
    // Get save location from config
    let save_location = {
        let config = config_state.lock().unwrap();
        config.get_config().default_save_location.clone()
    };
    
    // Get image data from memory cache
    let cache_key = timestamp.to_string();
    let image_data = {
        let cache = SCREENSHOT_CACHE.get_or_init(|| Mutex::new(HashMap::new()));
        let cache_guard = cache.lock().unwrap();
        cache_guard.get(&cache_key).cloned()
    };
    
    let image_data = image_data.ok_or("Screenshot data not found in memory cache")?;
    
    // Create file path
    let filename = format!("snipp-{}.png", timestamp);
    let file_path = PathBuf::from(&save_location).join(&filename);
    
    // Ensure the save directory exists
    if let Some(parent) = file_path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create save directory: {}", e))?;
    }
    
    // Write to disk
    std::fs::write(&file_path, &image_data)
        .map_err(|e| format!("Failed to save file: {}", e))?;
    
    let file_path_str = file_path.to_string_lossy().to_string();
    println!("Successfully saved screenshot to: {}", file_path_str);
    
    Ok(file_path_str)
}

#[tauri::command]
async fn delete_from_memory(timestamp: u64) -> Result<(), String> {
    println!("Deleting screenshot from memory cache: {}", timestamp);
    
    // Remove from memory cache
    let cache_key = timestamp.to_string();
    let cache = SCREENSHOT_CACHE.get_or_init(|| Mutex::new(HashMap::new()));
    {
        let mut cache_guard = cache.lock().unwrap();
        cache_guard.remove(&cache_key);
        println!("Removed screenshot from memory cache");
    }
    
    Ok(())
}

#[tauri::command]
async fn close_popup_window(app_handle: AppHandle) -> Result<(), String> {
    if let Some(popup_window) = app_handle.get_webview_window("popup") {
        popup_window.close()
            .map_err(|e| format!("Failed to close popup: {}", e))?;
    }
    Ok(())
}

#[tauri::command]
async fn get_config(config_state: State<'_, ConfigState>) -> Result<AppConfig, String> {
    let config = config_state.lock().unwrap();
    Ok(config.get_config().clone())
}

#[tauri::command]
async fn update_config(
    config_state: State<'_, ConfigState>,
    new_config: AppConfig,
) -> Result<(), String> {
    let mut config = config_state.lock().unwrap();
    config.update_config(new_config)
        .map_err(|e| format!("Failed to update config: {}", e))?;
    Ok(())
}

#[tauri::command]
async fn open_preferences_window(app_handle: AppHandle) -> Result<(), String> {
    // Check if preferences window already exists
    if app_handle.get_webview_window("preferences").is_some() {
        return Ok(());
    }
    
    let _preferences_window = WebviewWindowBuilder::new(
        &app_handle,
        "preferences",
        WebviewUrl::App("preferences.html".into())
    )
    .title("Snipp Preferences")
    .inner_size(480.0, 400.0)
    .resizable(false)
    .center()
    .build()
    .map_err(|e| format!("Failed to create preferences window: {}", e))?;
    
    Ok(())
}

#[tauri::command]
async fn close_preferences_window(app_handle: AppHandle) -> Result<(), String> {
    if let Some(preferences_window) = app_handle.get_webview_window("preferences") {
        preferences_window.close()
            .map_err(|e| format!("Failed to close preferences: {}", e))?;
    }
    Ok(())
}

#[tauri::command]
async fn choose_save_location(app_handle: AppHandle) -> Result<Option<String>, String> {
    use tokio::sync::oneshot;
    
    let (sender, receiver) = oneshot::channel();
    
    app_handle.dialog().file()
        .set_title("Choose Save Location")
        .pick_folder(move |folder_path| {
            let result = folder_path.map(|p| p.to_string());
            let _ = sender.send(result);
        });
    
    let folder = receiver.await
        .map_err(|e| format!("Dialog receiver error: {}", e))?;
    
    Ok(folder)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let config_manager = ConfigManager::new().expect("Failed to initialize config manager");
    
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(ConfigState::new(config_manager))
        .invoke_handler(tauri::generate_handler![
            capture_screenshot,
            copy_to_clipboard,
            save_to_disk,
            delete_from_memory,
            close_popup_window,
            get_config,
            update_config,
            open_preferences_window,
            close_preferences_window,
            choose_save_location
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
