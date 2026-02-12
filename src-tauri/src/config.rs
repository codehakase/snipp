use serde::{Deserialize, Serialize};
use std::path::PathBuf;

pub const DEFAULT_FULLSCREEN_HOTKEY: &str = "CommandOrControl+Shift+F";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    pub default_save_location: String,
    pub capture_hotkey: String,
    pub preferences_hotkey: String,
    pub auto_copy_after_capture: bool,
    pub auto_copy_after_edit: bool,
}

impl Default for AppConfig {
    fn default() -> Self {
        let home_dir = std::env::var("HOME").unwrap_or_default();
        Self {
            default_save_location: format!("{}/Desktop", home_dir),
            capture_hotkey: "CommandOrControl+Shift+S".to_string(),
            preferences_hotkey: "CommandOrControl+Comma".to_string(),
            auto_copy_after_capture: true,
            auto_copy_after_edit: false,
        }
    }
}

impl AppConfig {
    pub fn load() -> Result<Self, Box<dyn std::error::Error>> {
        let config_path = Self::get_config_path()?;
        println!("config path: {}", config_path.to_string_lossy());

        if config_path.exists() {
            let contents = std::fs::read_to_string(&config_path)?;
            let mut config: AppConfig = serde_json::from_str(&contents)?;
            if config.normalize_hotkeys() {
                config.save()?;
            }
            Ok(config)
        } else {
            let mut config = AppConfig::default();
            config.normalize_hotkeys();
            config.save()?;
            Ok(config)
        }
    }

    pub fn save(&self) -> Result<(), Box<dyn std::error::Error>> {
        let config_path = Self::get_config_path()?;

        if let Some(parent) = config_path.parent() {
            std::fs::create_dir_all(parent)?;
        }

        let contents = serde_json::to_string_pretty(self)?;
        std::fs::write(&config_path, contents)?;
        Ok(())
    }

    fn get_config_path() -> Result<PathBuf, Box<dyn std::error::Error>> {
        let config_dir = dirs::config_dir()
            .ok_or("Failed to get config directory")?
            .join("snipp");

        Ok(config_dir.join("config.json"))
    }

    fn normalize_hotkeys(&mut self) -> bool {
        let normalized_capture = normalize_hotkey(&self.capture_hotkey);
        let normalized_preferences = normalize_hotkey(&self.preferences_hotkey);
        let changed = normalized_capture != self.capture_hotkey
            || normalized_preferences != self.preferences_hotkey;

        self.capture_hotkey = normalized_capture;
        self.preferences_hotkey = normalized_preferences;

        changed
    }
}

fn normalize_hotkey(raw_hotkey: &str) -> String {
    let mut modifiers: Vec<String> = Vec::new();
    let mut key_parts: Vec<String> = Vec::new();

    for part in raw_hotkey
        .split(|c| c == '+' || c == ' ')
        .filter(|part| !part.is_empty())
    {
        let normalized = normalize_hotkey_part(part);
        if is_modifier(&normalized) {
            if !modifiers.contains(&normalized) {
                modifiers.push(normalized);
            }
        } else {
            key_parts.push(normalized);
        }
    }

    let mut ordered_modifiers: Vec<String> = Vec::new();
    for modifier in ["CommandOrControl", "Shift", "Alt", "Ctrl"] {
        if modifiers.iter().any(|item| item == modifier) {
            ordered_modifiers.push(modifier.to_string());
        }
    }

    let mut parts: Vec<String> = Vec::new();
    parts.extend(ordered_modifiers);
    parts.extend(key_parts);

    parts.join("+")
}

fn normalize_hotkey_part(part: &str) -> String {
    let lower = part.to_ascii_lowercase();
    match lower.as_str() {
        "cmd" | "command" | "commandorcontrol" | "commandorctrl" | "meta" | "super" => {
            "CommandOrControl".to_string()
        }
        "ctrl" | "control" => "Ctrl".to_string(),
        "alt" | "option" => "Alt".to_string(),
        "shift" => "Shift".to_string(),
        "esc" | "escape" => "Escape".to_string(),
        "return" | "enter" => "Enter".to_string(),
        "space" => "Space".to_string(),
        "tab" => "Tab".to_string(),
        "comma" => "Comma".to_string(),
        "period" | "dot" => "Period".to_string(),
        _ => normalize_key_name(part),
    }
}

fn normalize_key_name(part: &str) -> String {
    let trimmed = part.trim();
    if trimmed.len() == 1 {
        return trimmed.to_ascii_uppercase();
    }

    let lower = trimmed.to_ascii_lowercase();
    if let Some(stripped) = lower.strip_prefix('f') {
        if !stripped.is_empty() && stripped.chars().all(|c| c.is_ascii_digit()) {
            return format!("F{}", stripped);
        }
    }

    let mut chars = lower.chars();
    match chars.next() {
        Some(first) => {
            let mut normalized = String::new();
            normalized.push(first.to_ascii_uppercase());
            normalized.extend(chars);
            normalized
        }
        None => String::new(),
    }
}

fn is_modifier(value: &str) -> bool {
    matches!(value, "CommandOrControl" | "Shift" | "Alt" | "Ctrl")
}

pub struct ConfigManager {
    config: AppConfig,
}

impl ConfigManager {
    pub fn new() -> Result<Self, Box<dyn std::error::Error>> {
        let config = AppConfig::load()?;
        Ok(Self { config })
    }

    pub fn get_config(&self) -> &AppConfig {
        &self.config
    }

    pub fn update_config(
        &mut self,
        new_config: AppConfig,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let mut normalized_config = new_config;
        normalized_config.normalize_hotkeys();
        self.config = normalized_config;
        self.config.save()?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_app_config_default() {
        let original_home = std::env::var("HOME").ok();
        std::env::set_var("HOME", "/test/home");

        let config = AppConfig::default();

        assert_eq!(config.default_save_location, "/test/home/Desktop");
        assert_eq!(config.capture_hotkey, "CommandOrControl+Shift+S");
        assert_eq!(config.preferences_hotkey, "CommandOrControl+Comma");
        assert_eq!(config.auto_copy_after_capture, true);
        assert_eq!(config.auto_copy_after_edit, false);

        match original_home {
            Some(home) => std::env::set_var("HOME", home),
            None => std::env::remove_var("HOME"),
        }
    }

    #[test]
    fn test_app_config_serialization() {
        let config = AppConfig {
            default_save_location: "/test/path".to_string(),
            capture_hotkey: "Ctrl+S".to_string(),
            preferences_hotkey: "Ctrl+P".to_string(),
            auto_copy_after_capture: true,
            auto_copy_after_edit: true,
        };

        let json = serde_json::to_string(&config).expect("Failed to serialize");
        let deserialized: AppConfig = serde_json::from_str(&json).expect("Failed to deserialize");

        assert_eq!(
            config.default_save_location,
            deserialized.default_save_location
        );
        assert_eq!(config.capture_hotkey, deserialized.capture_hotkey);
        assert_eq!(config.preferences_hotkey, deserialized.preferences_hotkey);
        assert_eq!(
            config.auto_copy_after_capture,
            deserialized.auto_copy_after_capture
        );
        assert_eq!(
            config.auto_copy_after_edit,
            deserialized.auto_copy_after_edit
        );
    }

    #[test]
    fn test_config_manager_creation_with_default() {
        let config = AppConfig::default();
        let manager = ConfigManager {
            config: config.clone(),
        };

        let retrieved_config = manager.get_config();
        assert_eq!(
            retrieved_config.default_save_location,
            config.default_save_location
        );
        assert_eq!(retrieved_config.capture_hotkey, config.capture_hotkey);
        assert_eq!(
            retrieved_config.preferences_hotkey,
            config.preferences_hotkey
        );
    }

    #[test]
    fn test_config_manager_update_in_memory() {
        let initial_config = AppConfig::default();
        let mut manager = ConfigManager {
            config: initial_config,
        };

        let new_config = AppConfig {
            default_save_location: "/new/path".to_string(),
            capture_hotkey: "Alt+S".to_string(),
            preferences_hotkey: "Alt+P".to_string(),
            auto_copy_after_capture: false,
            auto_copy_after_edit: false,
        };

        manager.config = new_config.clone();

        let updated_config = manager.get_config();
        assert_eq!(
            updated_config.default_save_location,
            new_config.default_save_location
        );
        assert_eq!(updated_config.capture_hotkey, new_config.capture_hotkey);
        assert_eq!(
            updated_config.preferences_hotkey,
            new_config.preferences_hotkey
        );
    }

    #[test]
    fn test_normalize_hotkey_formats() {
        assert_eq!(normalize_hotkey("Cmd+Shift+2"), "CommandOrControl+Shift+2");
        assert_eq!(
            normalize_hotkey("command+shift+s"),
            "CommandOrControl+Shift+S"
        );
        assert_eq!(normalize_hotkey("ctrl alt p"), "Alt+Ctrl+P");
        assert_eq!(
            normalize_hotkey("CommandOrControl+Comma"),
            "CommandOrControl+Comma"
        );
    }
}
