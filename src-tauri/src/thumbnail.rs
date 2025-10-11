use image::{ImageFormat, DynamicImage, GenericImageView};
use std::path::{Path, PathBuf};
use std::fs;
use base64::Engine;

pub struct ThumbnailGenerator {
    cache_dir: PathBuf,
}

impl ThumbnailGenerator {
    pub fn new() -> Result<Self, Box<dyn std::error::Error>> {
        let cache_dir = dirs::cache_dir()
            .ok_or("Failed to get cache directory")?
            .join("snipp")
            .join("thumbnails");
        
        Self::with_cache_dir(cache_dir)
    }
    
    pub fn with_cache_dir(cache_dir: PathBuf) -> Result<Self, Box<dyn std::error::Error>> {
        fs::create_dir_all(&cache_dir)?;
        Ok(Self { cache_dir })
    }
    
    pub fn generate_thumbnail(&self, image_path: &str, max_size: u32) -> Result<String, Box<dyn std::error::Error>> {
        let source_path = Path::new(image_path);
        let filename = source_path.file_name()
            .and_then(|name| name.to_str())
            .ok_or("Invalid filename")?;
        
        let thumbnail_filename = format!("thumb_{}_{}.jpg", max_size, filename);
        let thumbnail_path = self.cache_dir.join(&thumbnail_filename);
        
        if thumbnail_path.exists() {
            return Ok(thumbnail_path.to_string_lossy().to_string());
        }
        
        let img = image::open(source_path)?;
        let thumbnail = self.resize_image(img, max_size);
        
        thumbnail.save_with_format(&thumbnail_path, ImageFormat::Jpeg)?;
        
        Ok(thumbnail_path.to_string_lossy().to_string())
    }
    
    
    pub fn get_thumbnail_base64(&self, image_path: &str, max_size: u32) -> Result<String, Box<dyn std::error::Error>> {
        let thumbnail_path = self.generate_thumbnail(image_path, max_size)?;
        let thumbnail_data = fs::read(&thumbnail_path)?;
        let base64_data = base64::prelude::BASE64_STANDARD.encode(&thumbnail_data);
        Ok(format!("data:image/jpeg;base64,{}", base64_data))
    }
    
    
    fn resize_image(&self, img: DynamicImage, max_size: u32) -> DynamicImage {
        let (width, height) = img.dimensions();
        
        if width <= max_size && height <= max_size {
            return img;
        }
        
        let aspect_ratio = width as f32 / height as f32;
        let (new_width, new_height) = if width > height {
            (max_size, (max_size as f32 / aspect_ratio) as u32)
        } else {
            ((max_size as f32 * aspect_ratio) as u32, max_size)
        };
        
        img.resize(new_width, new_height, image::imageops::FilterType::Lanczos3)
    }
    
    
    pub fn remove_thumbnail(&self, image_path: &str, max_size: u32) -> Result<(), Box<dyn std::error::Error>> {
        let source_path = Path::new(image_path);
        let filename = source_path.file_name()
            .and_then(|name| name.to_str())
            .ok_or("Invalid filename")?;
        
        let thumbnail_filename = format!("thumb_{}_{}.jpg", max_size, filename);
        let thumbnail_path = self.cache_dir.join(&thumbnail_filename);
        
        if thumbnail_path.exists() {
            fs::remove_file(&thumbnail_path)?;
        }
        
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;


    fn create_test_thumbnail_generator() -> (ThumbnailGenerator, TempDir) {
        let temp_dir = TempDir::new().expect("Failed to create temp directory");
        let cache_dir = temp_dir.path().join("thumbnails");
        let generator = ThumbnailGenerator::with_cache_dir(cache_dir).expect("Failed to create thumbnail generator");
        (generator, temp_dir)
    }

    #[test]
    fn test_thumbnail_generator_creation() {
        let temp_dir = TempDir::new().expect("Failed to create temp directory");
        let cache_dir = temp_dir.path().join("thumbnails");
        let generator = ThumbnailGenerator::with_cache_dir(cache_dir);
        assert!(generator.is_ok());
    }

    #[test]
    fn test_resize_image() {
        let (generator, _temp_dir) = create_test_thumbnail_generator();
        let img = DynamicImage::new_rgb8(200, 100);
        
        let resized = generator.resize_image(img, 50);
        let (width, height) = resized.dimensions();
        
        assert!(width <= 50 && height <= 50);
        assert!(width == 50 || height == 50);
    }

}