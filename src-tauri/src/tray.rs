use tauri::{
    AppHandle, Manager,
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::TrayIconBuilder,
    image::Image,
};
use tauri_plugin_opener::OpenerExt;

use crate::{AppConfig, ConfigState};
use crate::config::DEFAULT_FULLSCREEN_HOTKEY;

pub fn create_tray_menu(
    app: &AppHandle,
    config: &AppConfig,
) -> Result<Menu<tauri::Wry>, Box<dyn std::error::Error>> {
    let capture_area_hotkey = format_hotkey_for_menu(&config.capture_hotkey);
    let capture_screen_hotkey = format_hotkey_for_menu(DEFAULT_FULLSCREEN_HOTKEY);
    let preferences_hotkey = format_hotkey_for_menu(&config.preferences_hotkey);
    let open_snipp = MenuItem::with_id(app, "open_snipp", "Open Snipp", true, None::<&str>)?;
    let separator1 = PredefinedMenuItem::separator(app)?;
    let capture_screen = MenuItem::with_id(
        app,
        "capture_screen",
        "Capture Screen",
        true,
        Some(capture_screen_hotkey),
    )?;
    let capture_area = MenuItem::with_id(
        app,
        "capture_area",
        "Capture Area",
        true,
        Some(capture_area_hotkey),
    )?;
    let separator2 = PredefinedMenuItem::separator(app)?;
    let suggest_feature = MenuItem::with_id(app, "suggest_feature", "Suggest a Feature", true, None::<&str>)?;
    let report_bug = MenuItem::with_id(app, "report_bug", "Report a Bug", true, None::<&str>)?;
    let separator3 = PredefinedMenuItem::separator(app)?;
    let preferences = MenuItem::with_id(
        app,
        "preferences",
        "Preferences...",
        true,
        Some(preferences_hotkey),
    )?;
    let quit = PredefinedMenuItem::quit(app, Some("Quit Snipp"))?;

    let menu = Menu::with_items(app, &[
        &open_snipp,
        &separator1,
        &capture_screen,
        &capture_area,
        &separator2,
        &suggest_feature,
        &report_bug,
        &separator3,
        &preferences,
        &quit,
    ])?;

    Ok(menu)
}

pub fn setup_system_tray(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    println!("Setting up system tray...");
    let config = {
        let config_state = app.state::<ConfigState>();
        let config = config_state.lock().unwrap().get_config().clone();
        config
    };
    let menu = create_tray_menu(app, &config)?;
    println!("Tray menu created successfully");
    
    let icon_bytes = include_bytes!("../icons/AppIcon-32.png");
    let image_data = image::load_from_memory(icon_bytes)?;
    let rgba_data = image_data.to_rgba8();
    let (width, height) = (rgba_data.width(), rgba_data.height());
    let icon = Image::new_owned(rgba_data.into_raw(), width, height);
    
    let _tray = TrayIconBuilder::with_id("main")
        .tooltip("Snipp - Screenshot Tool")
        .icon(icon)
        .menu(&menu)
        .show_menu_on_left_click(true)
        .on_tray_icon_event(|tray_handle, event| {
            tauri_plugin_positioner::on_tray_event(tray_handle.app_handle(), &event);
        })
        .on_menu_event(move |app, event| {
            match event.id().as_ref() {
                "open_snipp" => {
                    if let Err(e) = show_main_window(app) {
                        eprintln!("Failed to show main window: {}", e);
                    }
                }
                "capture_screen" => {
                    if let Err(e) = trigger_screen_capture(app) {
                        eprintln!("Failed to trigger screen capture: {}", e);
                    }
                }
                "capture_area" => {
                    if let Err(e) = trigger_area_capture(app) {
                        eprintln!("Failed to trigger area capture: {}", e);
                    }
                }
                "suggest_feature" => {
                    if let Err(e) = open_url_with_app(app, "https://github.com/codehakase/snipp/issues/new?template=feature_request.md") {
                        eprintln!("Failed to open feature request URL: {}", e);
                    }
                }
                "report_bug" => {
                    if let Err(e) = open_url_with_app(app, "https://github.com/codehakase/snipp/issues/new?template=bug_report.md") {
                        eprintln!("Failed to open bug report URL: {}", e);
                    }
                }
                "preferences" => {
                    if let Err(e) = show_preferences_window(app) {
                        eprintln!("Failed to show preferences: {}", e);
                    }
                }
                _ => {}
            }
        })
        .build(app)?;

    println!("System tray built successfully!");
    Ok(())
}

pub fn update_tray_menu(
    app: &AppHandle,
    config: &AppConfig,
) -> Result<(), Box<dyn std::error::Error>> {
    if let Some(tray) = app.tray_by_id("main") {
        let menu = create_tray_menu(app, config)?;
        tray.set_menu(Some(menu))?;
    }
    Ok(())
}

fn format_hotkey_for_menu(hotkey: &str) -> String {
    let parts: Vec<&str> = hotkey
        .split('+')
        .filter(|part| !part.is_empty())
        .collect();

    let mut formatted: Vec<String> = Vec::new();
    for part in parts {
        let normalized = match part {
            "CommandOrControl" => "Cmd",
            "Shift" => "Shift",
            "Alt" => "Alt",
            "Ctrl" => "Ctrl",
            "Comma" => ",",
            "Period" => ".",
            "Space" => "Space",
            "Escape" => "Esc",
            _ => part,
        };
        formatted.push(normalized.to_string());
    }

    formatted.join("+")
}

fn show_main_window(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    if let Some(window) = app.get_webview_window("main") {
        window.show()?;
        window.set_focus()?;
        window.center()?;
    }
    Ok(())
}

fn trigger_screen_capture(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let app_handle = app.clone();
    tauri::async_runtime::spawn(async move {
        match crate::capture_full_screen(app_handle.clone(), app_handle.state::<ConfigState>()).await {
            Ok(_) => println!("Full screen capture completed successfully"),
            Err(e) => eprintln!("Failed to capture full screen: {}", e),
        }
    });
    Ok(())
}

fn trigger_area_capture(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let app_handle = app.clone();
    tauri::async_runtime::spawn(async move {
        match crate::capture_screenshot(app_handle.clone(), app_handle.state::<ConfigState>()).await {
            Ok(_) => println!("Area capture completed successfully"),
            Err(e) => eprintln!("Failed to capture area: {}", e),
        }
    });
    Ok(())
}

fn open_url_with_app(app: &AppHandle, url: &str) -> Result<(), Box<dyn std::error::Error>> {
    println!("Attempting to open URL: {}", url);

    match app.opener().open_url(url, None::<&str>) {
        Ok(_) => {
            Ok(())
        }
        Err(e) => {
            eprintln!("Failed to open URL {}: {}", url, e);
            Err(Box::new(e))
        }
    }
}

fn show_preferences_window(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let app_handle = app.clone();
    tauri::async_runtime::spawn(async move {
        match crate::open_preferences_window(app_handle).await {
            Ok(_) => println!("Preferences window opened"),
            Err(e) => eprintln!("Failed to open preferences: {}", e),
        }
    });
    Ok(())
}
