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
            capture_hotkey: "CommandOrControl+Shift+2".to_string(),
            preferences_hotkey: "CommandOrControl+Comma".to_string(),
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