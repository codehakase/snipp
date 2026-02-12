use tauri::{App, AppHandle, Emitter, Manager, State, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_clipboard_manager::ClipboardExt;
use tauri_plugin_shell::ShellExt;
use tauri_plugin_dialog::DialogExt;
use std::path::PathBuf;
use std::sync::Mutex;
use std::collections::HashMap;
use base64::prelude::*;
use chrono::{Local, TimeZone};


#[cfg(target_os = "macos")]
use cocoa::appkit::NSEvent;
#[cfg(target_os = "macos")]
use cocoa::foundation::NSAutoreleasePool;

type ScreenshotCache = Mutex<HashMap<String, Vec<u8>>>;
static SCREENSHOT_CACHE: std::sync::OnceLock<ScreenshotCache> = std::sync::OnceLock::new();

mod config;
mod history;
mod thumbnail;
mod tray;

use config::{AppConfig, ConfigManager, DEFAULT_FULLSCREEN_HOTKEY};
use history::HistoryManager;
use thumbnail::ThumbnailGenerator;

type ConfigState = Mutex<ConfigManager>;
type HistoryState = Mutex<HistoryManager>;
type ThumbnailState = Mutex<ThumbnailGenerator>;

#[derive(Debug, serde::Serialize, serde::Deserialize, Clone)]
pub struct ScreenshotData {
    pub base64_image: String,
    pub filename: String,
    pub timestamp: u64,
    pub file_path: Option<String>, // Only set when saved to disk
}

fn build_screenshot_filename(timestamp: u64) -> String {
    let formatted = Local
        .timestamp_opt(timestamp as i64, 0)
        .single()
        .map(|dt| dt.format("%y-%m-%d at %H.%M.%S").to_string())
        .unwrap_or_else(|| timestamp.to_string());
    format!("Snipp {}.png", formatted)
}

#[tauri::command]
async fn capture_screenshot(
    app_handle: AppHandle,
    config_state: State<'_, ConfigState>,
) -> Result<ScreenshotData, String> {
    capture_screenshot_internal(app_handle, config_state).await
}

async fn capture_screenshot_internal(
    app_handle: AppHandle,
    config_state: State<'_, ConfigState>,
) -> Result<ScreenshotData, String> {
    println!("Starting memory-first screenshot capture...");
    
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs();
    
    let filename = build_screenshot_filename(timestamp);
    
    let temp_path = std::env::temp_dir().join(format!("snipp_capture_{}.png", timestamp));
    
    let shell = app_handle.shell();
    let output = shell
        .command("screencapture")
        .args(["-i", "-t", "png", temp_path.to_string_lossy().as_ref()])
        .output()
        .await
        .map_err(|e| format!("Failed to execute screencapture: {}", e))?;
    
    if !output.status.success() {
        let _ = std::fs::remove_file(&temp_path);
        return Err("Screenshot capture was cancelled or failed".to_string());
    }
    
    let image_data = std::fs::read(&temp_path)
        .map_err(|e| format!("Failed to read captured screenshot: {}", e))?;
    
    let _ = std::fs::remove_file(&temp_path);
    
    if image_data.is_empty() {
        return Err("No image data captured".to_string());
    }
    
    println!("Captured {} bytes of image data", image_data.len());
    
    let base64_image = base64::prelude::BASE64_STANDARD.encode(&image_data);
    
    let cache_key = timestamp.to_string();
    let cache = SCREENSHOT_CACHE.get_or_init(|| Mutex::new(HashMap::new()));
    {
        let mut cache_guard = cache.lock().unwrap();
        cache_guard.insert(cache_key.clone(), image_data.clone());
        println!("Stored image in memory cache with key: {}", cache_key);
    }
    
    let screenshot_data = ScreenshotData {
        base64_image,
        filename: filename.clone(),
        timestamp,
        file_path: None, // Will be set when/if saved to disk
    };
    
    // Auto-copy to clipboard if enabled
    let should_auto_copy = {
        let config = config_state.lock().unwrap();
        config.get_config().auto_copy_after_capture
    };
    
    if should_auto_copy {
        if let Err(e) = write_png_bytes_to_clipboard(&app_handle, &image_data) {
            eprintln!("Auto-copy failed: {}", e);
        } else {
            println!("Auto-copied screenshot to clipboard after capture");
        }
    }
    
    show_popup_window(&app_handle, &screenshot_data).await?;
    
    Ok(screenshot_data)
}

async fn capture_screenshot_internal_with_auto_copy(
    app_handle: AppHandle,
    auto_copy: bool,
) -> Result<ScreenshotData, String> {
    println!("Starting memory-first screenshot capture (auto_copy={})...", auto_copy);
    
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs();
    
    let filename = build_screenshot_filename(timestamp);
    
    let temp_path = std::env::temp_dir().join(format!("snipp_capture_{}.png", timestamp));
    
    let shell = app_handle.shell();
    let output = shell
        .command("screencapture")
        .args(["-i", "-t", "png", temp_path.to_string_lossy().as_ref()])
        .output()
        .await
        .map_err(|e| format!("Failed to execute screencapture: {}", e))?;
    
    if !output.status.success() {
        let _ = std::fs::remove_file(&temp_path);
        return Err("Screenshot capture was cancelled or failed".to_string());
    }
    
    let image_data = std::fs::read(&temp_path)
        .map_err(|e| format!("Failed to read captured screenshot: {}", e))?;
    
    let _ = std::fs::remove_file(&temp_path);
    
    if image_data.is_empty() {
        return Err("No image data captured".to_string());
    }
    
    println!("Captured {} bytes of image data", image_data.len());
    
    let base64_image = base64::prelude::BASE64_STANDARD.encode(&image_data);
    
    let cache_key = timestamp.to_string();
    let cache = SCREENSHOT_CACHE.get_or_init(|| Mutex::new(HashMap::new()));
    {
        let mut cache_guard = cache.lock().unwrap();
        cache_guard.insert(cache_key.clone(), image_data.clone());
        println!("Stored image in memory cache with key: {}", cache_key);
    }
    
    // Auto-copy to clipboard if enabled
    if auto_copy {
        if let Err(e) = write_png_bytes_to_clipboard(&app_handle, &image_data) {
            eprintln!("Auto-copy failed: {}", e);
        } else {
            println!("Auto-copied screenshot to clipboard after capture");
        }
    }
    
    let screenshot_data = ScreenshotData {
        base64_image,
        filename: filename.clone(),
        timestamp,
        file_path: None,
    };
    
    show_popup_window(&app_handle, &screenshot_data).await?;
    
    Ok(screenshot_data)
}

#[tauri::command]
async fn capture_full_screen(
    app_handle: AppHandle,
    config_state: State<'_, ConfigState>,
) -> Result<ScreenshotData, String> {
    println!("Starting full screen capture...");
    
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs();
    
    let filename = build_screenshot_filename(timestamp);
    
    let temp_path = std::env::temp_dir().join(format!("snipp_fullscreen_{}.png", timestamp));
    
    let shell = app_handle.shell();
    let output = shell
        .command("screencapture")
        .args(["-t", "png", temp_path.to_string_lossy().as_ref()])
        .output()
        .await
        .map_err(|e| format!("Failed to execute screencapture: {}", e))?;
    
    if !output.status.success() {
        let _ = std::fs::remove_file(&temp_path);
        return Err("Full screen capture failed".to_string());
    }
    
    let image_data = std::fs::read(&temp_path)
        .map_err(|e| format!("Failed to read captured screenshot: {}", e))?;
    
    let _ = std::fs::remove_file(&temp_path);
    
    if image_data.is_empty() {
        return Err("No image data captured".to_string());
    }
    
    println!("Captured {} bytes of full screen image data", image_data.len());
    
    let base64_image = base64::prelude::BASE64_STANDARD.encode(&image_data);
    
    let cache_key = timestamp.to_string();
    let cache = SCREENSHOT_CACHE.get_or_init(|| Mutex::new(HashMap::new()));
    {
        let mut cache_guard = cache.lock().unwrap();
        cache_guard.insert(cache_key.clone(), image_data.clone());
        println!("Stored full screen image in memory cache with key: {}", cache_key);
    }
    
    // Auto-copy to clipboard if enabled
    let should_auto_copy = {
        let config = config_state.lock().unwrap();
        config.get_config().auto_copy_after_capture
    };
    
    if should_auto_copy {
        if let Err(e) = write_png_bytes_to_clipboard(&app_handle, &image_data) {
            eprintln!("Auto-copy failed: {}", e);
        } else {
            println!("Auto-copied screenshot to clipboard after capture");
        }
    }
    
    let screenshot_data = ScreenshotData {
        base64_image,
        filename: filename.clone(),
        timestamp,
        file_path: None,
    };
    
    show_popup_window(&app_handle, &screenshot_data).await?;
    
    Ok(screenshot_data)
}

async fn show_popup_window(app_handle: &AppHandle, screenshot_data: &ScreenshotData) -> Result<(), String> {
    println!("Creating popup window for screenshot: {}", screenshot_data.filename);

    // Close existing popup window if it exists
    if let Some(existing_popup) = app_handle.get_webview_window("popup") {
        println!("Closing existing popup window");
        existing_popup.close().map_err(|e| format!("Failed to close existing popup: {}", e))?;
        // Small delay to ensure cleanup
        tokio::time::sleep(tokio::time::Duration::from_millis(50)).await;
    }

    let popup_width = 320.0;
    let popup_height = 220.0;
    let padding = 20.0;

    // Get primary monitor size for proper positioning
    let (x_position, y_position) = if let Some(monitor) = app_handle.primary_monitor().ok().flatten() {
        let screen_size = monitor.size();
        let scale_factor = monitor.scale_factor();
        let screen_height = screen_size.height as f64 / scale_factor;
        // Bottom-left position with padding from edges
        (padding, screen_height - popup_height - padding - 50.0) // 50px extra for dock
    } else {
        // Fallback position
        (padding, 600.0)
    };

    let popup_window = WebviewWindowBuilder::new(
        app_handle,
        "popup",
        WebviewUrl::App("popup.html".into())
    )
    .title("Screenshot Captured")
    .inner_size(popup_width, popup_height)
    .position(x_position, y_position)
    .decorations(false)
    .transparent(true)
    .always_on_top(true)
    .skip_taskbar(true)
    .resizable(false)
    .minimizable(false)
    .maximizable(false)
    .disable_drag_drop_handler()
    .build()
    .map_err(|e| format!("Failed to create popup window: {}", e))?;
    
    println!("Popup window created successfully");
    
    popup_window.show()
        .map_err(|e| format!("Failed to show popup: {}", e))?;
    
    println!("Waiting 500ms for popup to load...");
    tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
    
    println!("Emitting screenshot-data event to popup");
    popup_window.emit("screenshot-data", screenshot_data)
        .map_err(|e| format!("Failed to emit screenshot data: {}", e))?;
    
    // Emit multiple times to ensure React app receives it
    for i in 1..=3 {
        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
        println!("Re-emitting screenshot-data event (attempt {})", i);
        let _ = popup_window.emit("screenshot-data", screenshot_data);
    }
    
    println!("Event emitted successfully");
    
    Ok(())
}

#[cfg(target_os = "macos")]
#[allow(dead_code)]
fn get_cursor_position() -> (f64, f64) {
    unsafe {
        let _pool = NSAutoreleasePool::new(cocoa::base::nil);
        let mouse_location = NSEvent::mouseLocation(cocoa::base::nil);
        
        let screen = cocoa::appkit::NSScreen::mainScreen(cocoa::base::nil);
        let screen_frame = cocoa::appkit::NSScreen::frame(screen);
        let screen_height = screen_frame.size.height;
        
        (mouse_location.x, screen_height - mouse_location.y)
    }
}

#[cfg(not(target_os = "macos"))]
fn get_cursor_position() -> (f64, f64) {
    (600.0, 400.0)
}

fn write_png_bytes_to_clipboard(app_handle: &AppHandle, png_bytes: &[u8]) -> Result<(), String> {
    let decoded = image::load_from_memory(png_bytes)
        .map_err(|e| format!("Failed to decode image data: {}", e))?;
    let rgba = decoded.to_rgba8();
    let (width, height) = rgba.dimensions();
    let clipboard_image = tauri::image::Image::new_owned(rgba.into_raw(), width, height);

    app_handle
        .clipboard()
        .write_image(&clipboard_image)
        .map_err(|e| format!("Failed to write image to clipboard: {}", e))?;

    Ok(())
}


#[tauri::command]
async fn copy_to_clipboard(
    app_handle: AppHandle,
    timestamp: u64,
) -> Result<(), String> {
    println!("Copying screenshot to clipboard from memory cache: {}", timestamp);
    
    let cache_key = timestamp.to_string();
    let image_data = {
        let cache = SCREENSHOT_CACHE.get_or_init(|| Mutex::new(HashMap::new()));
        let cache_guard = cache.lock().unwrap();
        cache_guard.get(&cache_key).cloned()
    };
    
    let image_data = image_data.ok_or("Screenshot data not found in memory cache")?;

    write_png_bytes_to_clipboard(&app_handle, &image_data)?;
    println!("Successfully copied screenshot to clipboard");
    Ok(())
}

#[tauri::command]
async fn save_to_disk(
    timestamp: u64,
    config_state: State<'_, ConfigState>,
    history_state: State<'_, HistoryState>,
) -> Result<String, String> {
    println!("Saving screenshot to disk from memory cache: {}", timestamp);
    
    let save_location = {
        let config = config_state.lock().unwrap();
        config.get_config().default_save_location.clone()
    };
    
    let cache_key = timestamp.to_string();
    let image_data = {
        let cache = SCREENSHOT_CACHE.get_or_init(|| Mutex::new(HashMap::new()));
        let cache_guard = cache.lock().unwrap();
        cache_guard.get(&cache_key).cloned()
    };
    
    let image_data = image_data.ok_or("Screenshot data not found in memory cache")?;
    
    let filename = build_screenshot_filename(timestamp);
    let file_path = PathBuf::from(&save_location).join(&filename);
    
    if let Some(parent) = file_path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create save directory: {}", e))?;
    }
    
    std::fs::write(&file_path, &image_data)
        .map_err(|e| format!("Failed to save file: {}", e))?;
    
    let file_path_str = file_path.to_string_lossy().to_string();
    println!("Successfully saved screenshot to: {}", file_path_str);
    
    {
        let mut history = history_state.lock().unwrap();
        if let Err(e) = history.add_screenshot(file_path_str.clone()) {
            eprintln!("Failed to add screenshot to history: {}", e);
        }
    }
    
    Ok(file_path_str)
}

#[tauri::command]
async fn delete_from_memory(timestamp: u64) -> Result<(), String> {
    println!("Deleting screenshot from memory cache: {}", timestamp);
    
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
    app_handle: AppHandle,
    config_state: State<'_, ConfigState>,
    new_config: AppConfig,
) -> Result<(), String> {
    let updated_config = {
        let mut config = config_state.lock().unwrap();
        config.update_config(new_config)
            .map_err(|e| format!("Failed to update config: {}", e))?;
        config.get_config().clone()
    };

    apply_global_shortcuts(&app_handle, &updated_config)?;
    tray::update_tray_menu(&app_handle, &updated_config)
        .map_err(|e| format!("Failed to update tray menu: {}", e))?;
    Ok(())
}



#[tauri::command]
async fn hide_window(app_handle: AppHandle) -> Result<(), String> {
    if let Some(main_window) = app_handle.get_webview_window("main") {
        main_window
            .hide()
            .map_err(|e| format!("Failed to hide main window: {}", e))?;
    }
    Ok(())
}

#[tauri::command]
async fn show_window(app_handle: AppHandle) -> Result<(), String> {
    if let Some(main_window) = app_handle.get_webview_window("main") {
        main_window
            .show()
            .map_err(|e| format!("Failed to show main window: {}", e))?;
        let _ = main_window.set_focus();
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

#[tauri::command]
async fn get_recent_screenshots(
    history_state: State<'_, HistoryState>,
    thumbnail_state: State<'_, ThumbnailState>,
) -> Result<Vec<serde_json::Value>, String> {
    let history = history_state.lock().unwrap();
    let thumbnail_gen = thumbnail_state.lock().unwrap();
    
    let recent_screenshots = history.get_recent_screenshots(10);
    let mut screenshots_with_thumbnails = Vec::new();
    
    for screenshot in recent_screenshots {
        let thumbnail_base64 = if std::path::Path::new(&screenshot.file_path).exists() {
            thumbnail_gen.get_thumbnail_base64(&screenshot.file_path, 64)
                .unwrap_or_else(|_| "".to_string())
        } else {
            "".to_string()
        };
        
        let screenshot_data = serde_json::json!({
            "file_path": screenshot.file_path,
            "timestamp": screenshot.timestamp,
            "filename": screenshot.filename,
            "thumbnail": thumbnail_base64,
        });
        
        screenshots_with_thumbnails.push(screenshot_data);
    }
    
    Ok(screenshots_with_thumbnails)
}

#[tauri::command]
async fn copy_screenshot_from_path(
    app_handle: AppHandle,
    file_path: String,
) -> Result<(), String> {
    let image_data = std::fs::read(&file_path)
        .map_err(|e| format!("Failed to read image file: {}", e))?;

    write_png_bytes_to_clipboard(&app_handle, &image_data)?;
    println!("Successfully copied screenshot to clipboard");
    Ok(())
}

#[tauri::command]
async fn open_in_finder(file_path: String) -> Result<(), String> {
    let output = std::process::Command::new("open")
        .arg("-R")
        .arg(&file_path)
        .output()
        .map_err(|e| format!("Failed to open in Finder: {}", e))?;
    
    if output.status.success() {
        Ok(())
    } else {
        let error = String::from_utf8_lossy(&output.stderr);
        Err(format!("Failed to reveal in Finder: {}", error))
    }
}

#[tauri::command]
async fn delete_screenshot(
    file_path: String,
    history_state: State<'_, HistoryState>,
    thumbnail_state: State<'_, ThumbnailState>,
) -> Result<(), String> {
    if std::path::Path::new(&file_path).exists() {
        std::fs::remove_file(&file_path)
            .map_err(|e| format!("Failed to delete file: {}", e))?;
    }
    
    {
        let mut history = history_state.lock().unwrap();
        if let Err(e) = history.remove_screenshot(&file_path) {
            eprintln!("Failed to remove screenshot from history: {}", e);
        }
    }
    
    {
        let thumbnail_gen = thumbnail_state.lock().unwrap();
        if let Err(e) = thumbnail_gen.remove_thumbnail(&file_path, 64) {
            eprintln!("Failed to remove thumbnail: {}", e);
        }
    }
    
    Ok(())
}

#[tauri::command]
async fn close_recent_window(app_handle: AppHandle) -> Result<(), String> {
    if let Some(recent_window) = app_handle.get_webview_window("recent_screenshots") {
        recent_window.close()
            .map_err(|e| format!("Failed to close recent window: {}", e))?;
    }
    Ok(())
}

#[tauri::command]
async fn open_editor_window(
    app_handle: AppHandle,
    timestamp: u64,
) -> Result<(), String> {
    println!("Opening editor window for screenshot: {}", timestamp);

    // Get screenshot data from cache
    let cache_key = timestamp.to_string();
    let image_data = {
        let cache = SCREENSHOT_CACHE.get_or_init(|| Mutex::new(HashMap::new()));
        let cache_guard = cache.lock().unwrap();
        cache_guard.get(&cache_key).cloned()
    };

    let image_data = image_data.ok_or("Screenshot data not found in memory cache")?;
    let base64_image = base64::prelude::BASE64_STANDARD.encode(&image_data);

    // Close existing editor if open
    if let Some(existing_editor) = app_handle.get_webview_window("editor") {
        existing_editor.close().map_err(|e| format!("Failed to close existing editor: {}", e))?;
        tokio::time::sleep(tokio::time::Duration::from_millis(50)).await;
    }

    // Create editor window
    let editor_window = WebviewWindowBuilder::new(
        &app_handle,
        "editor",
        WebviewUrl::App("editor.html".into())
    )
    .title("Snipp Editor")
    .inner_size(1200.0, 800.0)
    .min_inner_size(800.0, 600.0)
    .center()
    .resizable(true)
    .build()
    .map_err(|e| format!("Failed to create editor window: {}", e))?;

    editor_window.show().map_err(|e| format!("Failed to show editor: {}", e))?;

    // Wait for window to load
    tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;

    // Create editor data struct and emit
    let editor_data = serde_json::json!({
        "base64_image": base64_image,
        "timestamp": timestamp,
    });

    editor_window.emit("editor-data", &editor_data)
        .map_err(|e| format!("Failed to emit editor data: {}", e))?;

    // Re-emit to ensure React receives it
    for _ in 1..=3 {
        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
        let _ = editor_window.emit("editor-data", &editor_data);
    }

    Ok(())
}

#[tauri::command]
async fn close_editor_window(app_handle: AppHandle) -> Result<(), String> {
    if let Some(editor_window) = app_handle.get_webview_window("editor") {
        editor_window.close()
            .map_err(|e| format!("Failed to close editor: {}", e))?;
    }
    Ok(())
}

#[tauri::command]
async fn save_edited_screenshot(
    app_handle: AppHandle,
    base64_image: String,
    timestamp: u64,
    config_state: State<'_, ConfigState>,
    history_state: State<'_, HistoryState>,
) -> Result<String, String> {
    println!("Saving edited screenshot: {}", timestamp);

    let save_location = {
        let config = config_state.lock().unwrap();
        config.get_config().default_save_location.clone()
    };

    // Decode base64 image
    let image_data = base64::prelude::BASE64_STANDARD
        .decode(&base64_image)
        .map_err(|e| format!("Failed to decode image: {}", e))?;

    let filename = build_screenshot_filename(timestamp);
    let file_path = std::path::PathBuf::from(&save_location).join(&filename);

    if let Some(parent) = file_path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create save directory: {}", e))?;
    }

    std::fs::write(&file_path, &image_data)
        .map_err(|e| format!("Failed to save file: {}", e))?;

    let file_path_str = file_path.to_string_lossy().to_string();
    println!("Successfully saved edited screenshot to: {}", file_path_str);

    // Add to history
    {
        let mut history = history_state.lock().unwrap();
        if let Err(e) = history.add_screenshot(file_path_str.clone()) {
            eprintln!("Failed to add screenshot to history: {}", e);
        }
    }

    // Auto-copy edited screenshot to clipboard if enabled
    let should_auto_copy_edited = {
        let config = config_state.lock().unwrap();
        config.get_config().auto_copy_after_edit
    };

    if should_auto_copy_edited {
        if let Err(e) = write_png_bytes_to_clipboard(&app_handle, &image_data) {
            eprintln!("Auto-copy edited screenshot failed: {}", e);
        } else {
            println!("Auto-copied edited screenshot to clipboard after save");
        }
    }

    // Close editor after save
    if let Some(editor_window) = app_handle.get_webview_window("editor") {
        let _ = editor_window.close();
    }

    Ok(file_path_str)
}

#[tauri::command]
async fn copy_edited_screenshot(
    app_handle: AppHandle,
    base64_image: String,
    _timestamp: u64,
) -> Result<(), String> {
    println!("Copying edited screenshot to clipboard");

    let image_data = base64::prelude::BASE64_STANDARD
        .decode(&base64_image)
        .map_err(|e| format!("Failed to decode image: {}", e))?;

    write_png_bytes_to_clipboard(&app_handle, &image_data)?;
    println!("Successfully copied edited screenshot to clipboard");
    Ok(())
}

#[tauri::command]
async fn prepare_drag_file(timestamp: u64) -> Result<String, String> {
    let cache_key = timestamp.to_string();
    let image_data = {
        let cache = SCREENSHOT_CACHE.get_or_init(|| Mutex::new(HashMap::new()));
        let cache_guard = cache.lock().map_err(|e| format!("Cache lock error: {}", e))?;
        cache_guard.get(&cache_key).cloned()
    };

    let image_data = image_data.ok_or("Screenshot data not found in memory cache")?;

    let temp_path = std::env::temp_dir().join(build_screenshot_filename(timestamp));

    std::fs::write(&temp_path, &image_data)
        .map_err(|e| format!("Failed to write drag temp file: {}", e))?;

    Ok(temp_path.to_string_lossy().to_string())
}

#[tauri::command]
async fn cleanup_drag_file(timestamp: u64) -> Result<(), String> {
    let temp_path = std::env::temp_dir().join(build_screenshot_filename(timestamp));
    if temp_path.exists() {
        let _ = std::fs::remove_file(&temp_path);
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
fn setup_global_shortcuts(app: &App) -> Result<(), Box<dyn std::error::Error>> {
    app.handle()
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())?;

    let config_state = app.state::<ConfigState>();
    let config = config_state.lock().unwrap().get_config().clone();

    apply_global_shortcuts(&app.handle(), &config)
        .map_err(|e| -> Box<dyn std::error::Error> { e.into() })?;

    Ok(())
}

fn apply_global_shortcuts(app_handle: &AppHandle, config: &AppConfig) -> Result<(), String> {
    use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};

    let global_shortcut = app_handle.global_shortcut();
    global_shortcut
        .unregister_all()
        .map_err(|e| format!("Failed to unregister shortcuts: {}", e))?;

    let capture_hotkey = config.capture_hotkey.clone();
    global_shortcut
        .on_shortcut(capture_hotkey.as_str(), move |app, _shortcut, event| {
            if event.state() == ShortcutState::Pressed {
                let app_handle = app.clone();
                tauri::async_runtime::spawn(async move {
                    // Get config state from app handle for auto-copy check
                    let config_state = app_handle.state::<ConfigState>();
                    // Clone what we need before moving app_handle
                    let auto_copy = config_state.lock().unwrap().get_config().auto_copy_after_capture;
                    drop(config_state);
                    
                    if let Err(e) = capture_screenshot_internal_with_auto_copy(app_handle, auto_copy).await {
                        eprintln!("Failed to capture screenshot: {}", e);
                    }
                });
            }
        })
        .map_err(|e| format!("Failed to register capture hotkey: {}", e))?;

    let preferences_hotkey = config.preferences_hotkey.clone();
    global_shortcut
        .on_shortcut(preferences_hotkey.as_str(), move |app, _shortcut, event| {
            if event.state() == ShortcutState::Pressed {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                    let _ = window.center();
                }
            }
        })
        .map_err(|e| format!("Failed to register preferences hotkey: {}", e))?;

    global_shortcut
        .on_shortcut(DEFAULT_FULLSCREEN_HOTKEY, move |app, _shortcut, event| {
            if event.state() == ShortcutState::Pressed {
                let app_handle = app.clone();
                tauri::async_runtime::spawn(async move {
                    let config_state = app_handle.state::<ConfigState>();
                    if let Err(e) = capture_full_screen(app_handle.clone(), config_state).await {
                        eprintln!("Failed to capture full screen: {}", e);
                    }
                });
            }
        })
        .map_err(|e| format!("Failed to register fullscreen hotkey: {}", e))?;

    Ok(())
}

pub fn run() {
    let config_manager = ConfigManager::new().expect("Failed to initialize config manager");
    let history_manager = HistoryManager::new().expect("Failed to initialize history manager");
    let thumbnail_generator = ThumbnailGenerator::new().expect("Failed to initialize thumbnail generator");
    
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_positioner::init())
        .plugin(tauri_plugin_drag::init())
        .manage(ConfigState::new(config_manager))
        .manage(HistoryState::new(history_manager))
        .manage(ThumbnailState::new(thumbnail_generator))
        .setup(|app| {
            #[cfg(target_os = "macos")]
            {
                app.set_activation_policy(tauri::ActivationPolicy::Accessory);
            }
            tray::setup_system_tray(app.handle())?;
            
            app.get_webview_window("main").unwrap().hide().unwrap();
            
            setup_global_shortcuts(app)?;
            
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            capture_screenshot,
            capture_full_screen,
            copy_to_clipboard,
            save_to_disk,
            delete_from_memory,
            close_popup_window,
            get_config,
            update_config,
            choose_save_location,
            get_recent_screenshots,
            copy_screenshot_from_path,
            open_in_finder,
            delete_screenshot,
            close_recent_window,
            open_editor_window,
            close_editor_window,
            save_edited_screenshot,
            copy_edited_screenshot,
            prepare_drag_file,
            cleanup_drag_file,
            hide_window,
            show_window
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_screenshot_data_creation() {
        let data = ScreenshotData {
            base64_image: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAGAWA".to_string(),
            filename: "test-1234567890.png".to_string(),
            timestamp: 1234567890,
            file_path: None,
        };

        assert_eq!(data.filename, "test-1234567890.png");
        assert_eq!(data.timestamp, 1234567890);
        assert!(data.file_path.is_none());
        assert!(!data.base64_image.is_empty());
    }

    #[test]
    fn test_screenshot_data_with_file_path() {
        let mut data = ScreenshotData {
            base64_image: "test_data".to_string(),
            filename: "screenshot.png".to_string(),
            timestamp: 9876543210,
            file_path: None,
        };

        data.file_path = Some("/home/user/Desktop/screenshot.png".to_string());
        
        assert_eq!(data.file_path, Some("/home/user/Desktop/screenshot.png".to_string()));
    }

    #[test]
    fn test_screenshot_cache_operations() {
        let cache = SCREENSHOT_CACHE.get_or_init(|| Mutex::new(HashMap::new()));
        let test_key = "test_timestamp".to_string();
        let test_data = vec![1, 2, 3, 4, 5];

        {
            let mut cache_guard = cache.lock().unwrap();
            cache_guard.insert(test_key.clone(), test_data.clone());
        }

        let retrieved_data = {
            let cache_guard = cache.lock().unwrap();
            cache_guard.get(&test_key).cloned()
        };

        assert_eq!(retrieved_data, Some(test_data));
    }

    #[cfg(not(target_os = "macos"))]
    #[test]
    fn test_get_cursor_position_fallback() {
        let position = get_cursor_position();
        assert_eq!(position, (600.0, 400.0));
    }

    #[test]
    fn test_filename_generation() {
        let timestamp = 1234567890u64;
        let filename = build_screenshot_filename(timestamp);

        assert!(filename.starts_with("Snipp "));
        assert!(filename.contains(" at "));
        assert!(filename.ends_with(".png"));
        assert_eq!(filename.len(), 30);
    }

    #[test]
    fn test_prepare_drag_file_writes_and_returns_path() {
        let cache = SCREENSHOT_CACHE.get_or_init(|| Mutex::new(HashMap::new()));
        let timestamp = 8888888888u64;
        let test_png = vec![0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
        {
            let mut guard = cache.lock().unwrap();
            guard.insert(timestamp.to_string(), test_png.clone());
        }

        let temp_path = std::env::temp_dir().join(build_screenshot_filename(timestamp));
        let data = {
            let guard = cache.lock().unwrap();
            guard.get(&timestamp.to_string()).cloned().unwrap()
        };
        std::fs::write(&temp_path, &data).unwrap();

        assert!(temp_path.exists());
        let read_back = std::fs::read(&temp_path).unwrap();
        assert_eq!(read_back, test_png);

        // Path should be absolute, not a file:// URL
        let path_str = temp_path.to_string_lossy().to_string();
        assert!(path_str.starts_with('/'));
        assert!(!path_str.starts_with("file://"));
        assert!(path_str.ends_with(".png"));

        // Cleanup
        std::fs::remove_file(&temp_path).unwrap();
        {
            let mut guard = cache.lock().unwrap();
            guard.remove(&timestamp.to_string());
        }
    }

    #[test]
    fn test_cleanup_drag_file_ignores_missing() {
        let temp_path = std::env::temp_dir().join(build_screenshot_filename(2));
        let _ = std::fs::remove_file(&temp_path);
        // Should not panic
        if temp_path.exists() {
            let _ = std::fs::remove_file(&temp_path);
        }
        assert!(!temp_path.exists());
    }
}
