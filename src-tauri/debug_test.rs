use std::env;

fn main() {
    println!("HOME: {:?}", env::var("HOME"));
    println!("config_dir: {:?}", dirs::config_dir());
    println!("cache_dir: {:?}", dirs::cache_dir());
    
    if let Some(config_dir) = dirs::config_dir() {
        let snipp_config = config_dir.join("snipp");
        println!("snipp config dir: {:?}", snipp_config);
        println!("snipp config exists: {}", snipp_config.exists());
        println!("snipp config is_dir: {}", snipp_config.is_dir());
    }
    
    if let Some(cache_dir) = dirs::cache_dir() {
        let snipp_cache = cache_dir.join("snipp").join("thumbnails");
        println!("snipp cache dir: {:?}", snipp_cache);
        println!("snipp cache exists: {}", snipp_cache.exists());
        println!("snipp cache is_dir: {}", snipp_cache.is_dir());
    }
}
