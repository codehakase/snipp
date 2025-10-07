use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use chrono::{DateTime, Utc};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScreenshotHistory {
    pub file_path: String,
    pub timestamp: DateTime<Utc>,
    pub filename: String,
    pub thumbnail_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct HistoryData {
    pub screenshots: Vec<ScreenshotHistory>,
}

impl HistoryData {
    pub fn load() -> Result<Self, Box<dyn std::error::Error>> {
        let history_path = Self::get_history_path()?;
        Self::load_from_path(history_path)
    }
    
    pub fn load_from_path(history_path: PathBuf) -> Result<Self, Box<dyn std::error::Error>> {
        if history_path.exists() {
            let contents = std::fs::read_to_string(&history_path)?;
            let history: HistoryData = serde_json::from_str(&contents)?;
            Ok(history)
        } else {
            let history = HistoryData::default();
            history.save_to_path(history_path)?;
            Ok(history)
        }
    }
    
    pub fn save(&self) -> Result<(), Box<dyn std::error::Error>> {
        let history_path = Self::get_history_path()?;
        self.save_to_path(history_path)
    }
    
    pub fn save_to_path(&self, history_path: PathBuf) -> Result<(), Box<dyn std::error::Error>> {
        if let Some(parent) = history_path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        
        let contents = serde_json::to_string_pretty(self)?;
        std::fs::write(&history_path, contents)?;
        Ok(())
    }
    
    pub fn add_screenshot(&mut self, file_path: String) -> Result<(), Box<dyn std::error::Error>> {
        let path = PathBuf::from(&file_path);
        let filename = path.file_name()
            .and_then(|name| name.to_str())
            .unwrap_or("unknown.png")
            .to_string();
        
        let screenshot = ScreenshotHistory {
            file_path,
            timestamp: Utc::now(),
            filename,
            thumbnail_path: None,
        };
        
        self.screenshots.insert(0, screenshot);
        
        self.screenshots.truncate(50);
        
        self.save()?;
        Ok(())
    }
    
    pub fn add_screenshot_with_path(&mut self, file_path: String, history_path: PathBuf) -> Result<(), Box<dyn std::error::Error>> {
        let path = PathBuf::from(&file_path);
        let filename = path.file_name()
            .and_then(|name| name.to_str())
            .unwrap_or("unknown.png")
            .to_string();
        
        let screenshot = ScreenshotHistory {
            file_path,
            timestamp: Utc::now(),
            filename,
            thumbnail_path: None,
        };
        
        self.screenshots.insert(0, screenshot);
        
        self.screenshots.truncate(50);
        
        self.save_to_path(history_path)?;
        Ok(())
    }
    
    pub fn remove_screenshot(&mut self, file_path: &str) -> Result<(), Box<dyn std::error::Error>> {
        self.screenshots.retain(|screenshot| screenshot.file_path != file_path);
        self.save()?;
        Ok(())
    }
    
    pub fn remove_screenshot_with_path(&mut self, file_path: &str, history_path: PathBuf) -> Result<(), Box<dyn std::error::Error>> {
        self.screenshots.retain(|screenshot| screenshot.file_path != file_path);
        self.save_to_path(history_path)?;
        Ok(())
    }
    
    pub fn get_recent_screenshots(&self, limit: usize) -> Vec<&ScreenshotHistory> {
        self.screenshots.iter().take(limit).collect()
    }
    
    fn get_history_path() -> Result<PathBuf, Box<dyn std::error::Error>> {
        let config_dir = dirs::config_dir()
            .ok_or("Failed to get config directory")?
            .join("snipp");
        
        Ok(config_dir.join("history.json"))
    }
}

pub struct HistoryManager {
    history: HistoryData,
}

impl HistoryManager {
    pub fn new() -> Result<Self, Box<dyn std::error::Error>> {
        let history = HistoryData::load()?;
        Ok(Self { history })
    }
    
    #[allow(dead_code)]
    pub fn get_history(&self) -> &HistoryData {
        &self.history
    }
    
    pub fn add_screenshot(&mut self, file_path: String) -> Result<(), Box<dyn std::error::Error>> {
        self.history.add_screenshot(file_path)?;
        Ok(())
    }
    
    pub fn remove_screenshot(&mut self, file_path: &str) -> Result<(), Box<dyn std::error::Error>> {
        self.history.remove_screenshot(file_path)?;
        Ok(())
    }
    
    pub fn get_recent_screenshots(&self, limit: usize) -> Vec<&ScreenshotHistory> {
        self.history.get_recent_screenshots(limit)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    fn create_test_history_with_temp_dir() -> (HistoryData, TempDir) {
        let temp_dir = TempDir::new().expect("Failed to create temp directory");
        let history = HistoryData::default();
        (history, temp_dir)
    }

    #[test]
    fn test_history_data_default() {
        let history = HistoryData::default();
        assert_eq!(history.screenshots.len(), 0);
    }

    #[test]
    fn test_add_screenshot() {
        let (mut history, temp_dir) = create_test_history_with_temp_dir();
        let history_path = temp_dir.path().join("history.json");
        let file_path = "/test/path/screenshot.png".to_string();
        
        history.add_screenshot_with_path(file_path.clone(), history_path.clone()).unwrap();
        
        assert_eq!(history.screenshots.len(), 1);
        assert_eq!(history.screenshots[0].file_path, file_path);
        assert_eq!(history.screenshots[0].filename, "screenshot.png");
        
        let loaded_history = HistoryData::load_from_path(history_path).unwrap();
        assert_eq!(loaded_history.screenshots.len(), 1);
        assert_eq!(loaded_history.screenshots[0].file_path, file_path);
    }

    #[test]
    fn test_remove_screenshot() {
        let (mut history, temp_dir) = create_test_history_with_temp_dir();
        let history_path = temp_dir.path().join("history.json");
        let file_path = "/test/path/screenshot.png".to_string();
        
        history.add_screenshot_with_path(file_path.clone(), history_path.clone()).unwrap();
        assert_eq!(history.screenshots.len(), 1);
        
        history.remove_screenshot_with_path(&file_path, history_path.clone()).unwrap();
        assert_eq!(history.screenshots.len(), 0);
        
        let loaded_history = HistoryData::load_from_path(history_path).unwrap();
        assert_eq!(loaded_history.screenshots.len(), 0);
    }

    #[test]
    fn test_screenshot_limit() {
        let (mut history, temp_dir) = create_test_history_with_temp_dir();
        let history_path = temp_dir.path().join("history.json");
        
        for i in 0..60 {
            let file_path = format!("/test/path/screenshot_{}.png", i);
            history.add_screenshot_with_path(file_path, history_path.clone()).unwrap();
        }
        
        assert_eq!(history.screenshots.len(), 50);
        
        let loaded_history = HistoryData::load_from_path(history_path).unwrap();
        assert_eq!(loaded_history.screenshots.len(), 50);
    }

    #[test]
    fn test_get_recent_screenshots() {
        let (mut history, temp_dir) = create_test_history_with_temp_dir();
        let history_path = temp_dir.path().join("history.json");
        
        for i in 0..10 {
            let file_path = format!("/test/path/screenshot_{}.png", i);
            history.add_screenshot_with_path(file_path, history_path.clone()).unwrap();
        }
        
        let recent = history.get_recent_screenshots(5);
        assert_eq!(recent.len(), 5);
        
        assert_eq!(recent[0].filename, "screenshot_9.png");
        assert_eq!(recent[4].filename, "screenshot_5.png");
        
        let loaded_history = HistoryData::load_from_path(history_path).unwrap();
        let loaded_recent = loaded_history.get_recent_screenshots(5);
        assert_eq!(loaded_recent.len(), 5);
        assert_eq!(loaded_recent[0].filename, "screenshot_9.png");
    }
}