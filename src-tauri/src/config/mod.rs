pub mod patch;

use sha2::{Digest, Sha256};
use std::collections::HashSet;
use std::fs;
use std::path::PathBuf;

fn expand_path(path: &str) -> String {
    if let Some(stripped) = path.strip_prefix("~/") {
        if let Ok(home) = std::env::var("HOME") {
            return format!("{}/{}", home, stripped);
        }
    }
    path.to_string()
}

pub(crate) fn normalize_path(path: &str) -> String {
    let expanded = expand_path(path);
    std::fs::canonicalize(&expanded)
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or(expanded)
}

pub(crate) fn canonicalize_path(path: &str) -> Option<String> {
    let expanded = expand_path(path);
    std::fs::canonicalize(&expanded)
        .ok()
        .map(|p| p.to_string_lossy().to_string())
}

fn config_path() -> std::io::Result<PathBuf> {
    let home = std::env::var("HOME")
        .map_err(|_| std::io::Error::new(std::io::ErrorKind::NotFound, "HOME not set"))?;
    Ok(PathBuf::from(home).join(".codex").join("config.toml"))
}

pub fn load_config() -> std::io::Result<String> {
    let path = config_path()?;
    match fs::read_to_string(&path) {
        Ok(contents) => Ok(contents),
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => Ok(String::new()),
        Err(err) => Err(err),
    }
}

pub fn save_config(contents: &str) -> std::io::Result<()> {
    let path = config_path()?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(path, contents)
}

pub fn set_enabled(realpath: &str, enabled: bool) -> std::io::Result<String> {
    let original = load_config()?;
    let updated = patch::set_enabled(&original, realpath, enabled);
    save_config(&updated)?;
    Ok("restart_required".to_string())
}

pub fn disabled_paths() -> std::io::Result<HashSet<String>> {
    let mut disabled = HashSet::new();
    let contents = load_config()?;
    let mut in_block = false;
    let mut path_value: Option<String> = None;
    let mut enabled_value: Option<bool> = None;

    for line in contents.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with("[[") {
            if in_block {
                if enabled_value == Some(false) {
                    if let Some(path) = path_value.take() {
                        disabled.insert(normalize_path(&path));
                    }
                }
                path_value = None;
                enabled_value = None;
            }
            in_block = trimmed == "[[skills.config]]";
            continue;
        }
        if !in_block {
            continue;
        }
        if let Some(value) = patch::extract_path_value(trimmed) {
            let expanded = expand_path(&value);
            let canonical = canonicalize_path(&value);
            if canonical.is_none() {
                log::warn!("Non-resolvable path in config, using expanded path: {}", expanded);
            }
            // keep most-resolved path for the block, but also track raw/expanded variants
            path_value = canonical.clone().or(Some(expanded.clone()));
            disabled.insert(value);
            disabled.insert(expanded);
            if let Some(c) = canonical {
                disabled.insert(c);
            }
        } else if trimmed.starts_with("enabled") {
            enabled_value = Some(trimmed.contains("false"));
        }
    }

    if in_block && enabled_value == Some(false) {
        if let Some(path) = path_value {
            disabled.insert(normalize_path(&path));
        }
    }

    Ok(disabled)
}

pub fn config_fingerprint() -> std::io::Result<String> {
    let contents = load_config()?;
    if contents.is_empty() {
        return Ok(String::new());
    }
    let mut hasher = Sha256::new();
    hasher.update(contents.as_bytes());
    Ok(format!("{:x}", hasher.finalize()))
}

#[cfg(test)]
mod tests;
