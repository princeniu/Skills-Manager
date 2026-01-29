pub mod skills;
pub mod config;

use once_cell::sync::Lazy;
use std::sync::Mutex;
use std::time::{Duration, Instant};

#[derive(Clone, Default)]
struct SkillCache {
  last_scan: Option<Instant>,
  skills: Vec<skills::types::Skill>,
}

static SKILL_CACHE: Lazy<Mutex<SkillCache>> = Lazy::new(|| Mutex::new(SkillCache::default()));

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![
      list_skills,
      set_enabled,
      delete_skill,
      open_skill_location,
      get_config_fingerprint
    ])
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}

#[tauri::command]
fn list_skills() -> Result<Vec<skills::types::Skill>, String> {
    let root = skills::skills_root().map_err(|e| e.to_string())?;
    let mut items: Vec<skills::types::Skill> = Vec::new();
    let now = Instant::now();
    let mut used_cache = false;

    if let Ok(cache) = SKILL_CACHE.lock() {
      if let Some(last) = cache.last_scan {
        if now.duration_since(last) < Duration::from_secs(2) {
          items = cache.skills.clone();
          used_cache = true;
        }
      }
    }

    let disabled_result = std::thread::spawn(|| config::disabled_paths());
    if !used_cache {
      items = skills::scan_skills(&root).map_err(|e| e.to_string())?;
      if let Ok(mut cache) = SKILL_CACHE.lock() {
        cache.last_scan = Some(now);
        cache.skills = items.clone();
      }
    }
    let disabled = disabled_result.join().map_err(|_| "Failed to read config".to_string())?
      .map_err(|e| e.to_string())?;
    for item in &mut items {
        let norm_real = config::normalize_path(&item.realpath);
        let norm_path = config::normalize_path(&item.path);
        if disabled.contains(&item.realpath)
            || disabled.contains(&item.path)
            || disabled.contains(&norm_real)
            || disabled.contains(&norm_path)
        {
            item.enabled = false;
        }
    }
    items.sort_by(|a, b| a.slug.cmp(&b.slug));
    Ok(items)
}

#[tauri::command]
fn set_enabled(skill_realpath: String, enabled: bool) -> Result<String, String> {
    config::set_enabled(&skill_realpath, enabled).map_err(|e| e.to_string())
}

fn invalidate_cache() {
    if let Ok(mut cache) = SKILL_CACHE.lock() {
        cache.last_scan = None;
        cache.skills.clear();
    }
}

#[tauri::command]
fn delete_skill(skill_realpath: String) -> Result<(), String> {
    let root = skills::skills_root().map_err(|e| e.to_string())?;
    let real = std::fs::canonicalize(&skill_realpath).map_err(|e| e.to_string())?;
    if !real.starts_with(&root) {
        return Err("Refusing to delete path outside skills root".to_string());
    }
    trash::delete(&real).map_err(|e| format!("Trash failed: {e}"))?;
    invalidate_cache();
    if let Err(err) = config::set_enabled(&real.to_string_lossy(), true) {
        return Err(format!("Trash succeeded but config cleanup failed: {err}"));
    }
    Ok(())
}

#[tauri::command]
fn open_skill_location(skill_realpath: String) -> Result<(), String> {
    let real = std::fs::canonicalize(&skill_realpath).map_err(|e| e.to_string())?;
    if !real.exists() {
        return Err("Path does not exist".to_string());
    }

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg("-R")
            .arg(&real)
            .status()
            .map_err(|e| e.to_string())?;
        return Ok(());
    }

    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg("/select,")
            .arg(&real)
            .status()
            .map_err(|e| e.to_string())?;
        return Ok(());
    }

    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&real)
            .status()
            .map_err(|e| e.to_string())?;
        return Ok(());
    }

    #[allow(unreachable_code)]
    Err("Unsupported platform".to_string())
}

#[tauri::command]
fn get_config_fingerprint() -> Result<String, String> {
    config::config_fingerprint().map_err(|e| e.to_string())
}
