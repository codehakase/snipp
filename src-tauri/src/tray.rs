use tauri::{
    AppHandle, Manager,
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::TrayIconBuilder,
};
use tauri_plugin_opener::OpenerExt;

use crate::ConfigState;



pub fn create_tray_menu(app: &AppHandle) -> Result<Menu<tauri::Wry>, Box<dyn std::error::Error>> {
    let open_snipp = MenuItem::with_id(app, "open_snipp", "Open Snipp", true, None::<&str>)?;
    let separator1 = PredefinedMenuItem::separator(app)?;
    let capture_screen = MenuItem::with_id(app, "capture_screen", "Capture Screen", true, Some("⌘⇧3"))?;
    let capture_area = MenuItem::with_id(app, "capture_area", "Capture Area", true, Some("⌘⇧4"))?;
    let separator2 = PredefinedMenuItem::separator(app)?;
    let suggest_feature = MenuItem::with_id(app, "suggest_feature", "Suggest a Feature", true, None::<&str>)?;
    let report_bug = MenuItem::with_id(app, "report_bug", "Report a Bug", true, None::<&str>)?;
    let separator3 = PredefinedMenuItem::separator(app)?;
    let preferences = MenuItem::with_id(app, "preferences", "Preferences...", true, Some("⌘,"))?;
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
    let menu = create_tray_menu(app)?;
    
    let _tray = TrayIconBuilder::with_id("main")
        .tooltip("Snipp - Screenshot Tool")
        .icon(app.default_window_icon().unwrap().clone())
        .menu(&menu)
        .show_menu_on_left_click(true)
        .on_tray_icon_event(|_tray, _event| {})
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

    Ok(())
}

fn show_main_window(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    if let Some(window) = app.get_webview_window("main") {
        window.show()?;
        window.set_focus()?;
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
    let app_handle = app.clone();
    let url = url.to_string();
    
    tauri::async_runtime::spawn(async move {
        if let Err(e) = app_handle.opener().open_url(&url, None::<&str>) {
            eprintln!("Failed to open URL: {}", e);
        }
    });
    
    Ok(())
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

