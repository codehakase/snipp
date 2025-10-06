use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    pub default_save_location: String,
    pub capture_hotkey: String,
    pub preferences_hotkey: String,
}

impl Default for AppConfig {
    fn default() -> Self {
        let home_dir = std::env::var("HOME").unwrap_or_default();
        Self {
            default_save_location: format!("{}/Desktop", home_dir),
            capture_hotkey: "Cmd+Shift+2".to_string(),
            preferences_hotkey: "Cmd+Comma".to_string(),
        }
    }
}

impl AppConfig {
    pub fn load() -> Result<Self, Box<dyn std::error::Error>> {
        let config_path = Self::get_config_path()?;
        
        if config_path.exists() {
            let contents = std::fs::read_to_string(&config_path)?;
            let config: AppConfig = serde_json::from_str(&contents)?;
            Ok(config)
        } else {
            let config = AppConfig::default();
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
    
    pub fn update_config(&mut self, new_config: AppConfig) -> Result<(), Box<dyn std::error::Error>> {
        self.config = new_config;
        self.config.save()?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_app_config_default() {
        std::env::set_var("HOME", "/test/home");
        let config = AppConfig::default();
        
        assert_eq!(config.default_save_location, "/test/home/Desktop");
        assert_eq!(config.capture_hotkey, "Cmd+Shift+2");
        assert_eq!(config.preferences_hotkey, "Cmd+Comma");
    }

    #[test]
    fn test_app_config_serialization() {
        let config = AppConfig {
            default_save_location: "/test/path".to_string(),
            capture_hotkey: "Ctrl+S".to_string(),
            preferences_hotkey: "Ctrl+P".to_string(),
        };

        let json = serde_json::to_string(&config).expect("Failed to serialize");
        let deserialized: AppConfig = serde_json::from_str(&json).expect("Failed to deserialize");

        assert_eq!(config.default_save_location, deserialized.default_save_location);
        assert_eq!(config.capture_hotkey, deserialized.capture_hotkey);
        assert_eq!(config.preferences_hotkey, deserialized.preferences_hotkey);
    }

    #[test]
    fn test_config_manager_creation_with_default() {
        let config = AppConfig::default();
        let manager = ConfigManager { config: config.clone() };
        
        let retrieved_config = manager.get_config();
        assert_eq!(retrieved_config.default_save_location, config.default_save_location);
        assert_eq!(retrieved_config.capture_hotkey, config.capture_hotkey);
        assert_eq!(retrieved_config.preferences_hotkey, config.preferences_hotkey);
    }

    #[test]
    fn test_config_manager_update_in_memory() {
        let initial_config = AppConfig::default();
        let mut manager = ConfigManager { config: initial_config };
        
        let new_config = AppConfig {
            default_save_location: "/new/path".to_string(),
            capture_hotkey: "Alt+S".to_string(),
            preferences_hotkey: "Alt+P".to_string(),
        };

        manager.config = new_config.clone();

        let updated_config = manager.get_config();
        assert_eq!(updated_config.default_save_location, new_config.default_save_location);
        assert_eq!(updated_config.capture_hotkey, new_config.capture_hotkey);
        assert_eq!(updated_config.preferences_hotkey, new_config.preferences_hotkey);
    }

    #[test]
    fn test_screenshot_data_structure() {
        use crate::ScreenshotData;
        
        let data = ScreenshotData {
            base64_image: "test_base64".to_string(),
            filename: "test.png".to_string(),
            timestamp: 1234567890,
            file_path: Some("/path/to/file.png".to_string()),
        };

        assert_eq!(data.base64_image, "test_base64");
        assert_eq!(data.filename, "test.png");
        assert_eq!(data.timestamp, 1234567890);
        assert_eq!(data.file_path, Some("/path/to/file.png".to_string()));
    }

    #[test]
    fn test_cursor_position_fallback() {
        #[cfg(not(target_os = "macos"))]
        {
            use crate::get_cursor_position;
            let pos = get_cursor_position();
            assert_eq!(pos, (600.0, 400.0));
        }
    }
}