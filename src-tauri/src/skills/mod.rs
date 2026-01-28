pub mod types;
pub mod utils;

use crate::skills::types::Skill;
use crate::skills::utils::{hash_realpath, parse_skill_md};
use std::fs;
use std::path::Path;
use std::time::UNIX_EPOCH;

pub fn scan_skills(root: &Path) -> std::io::Result<Vec<Skill>> {
    let mut skills = Vec::new();
    for entry in fs::read_dir(root)? {
        let entry = entry?;
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }
        let skill_md = path.join("SKILL.md");
        if !skill_md.is_file() {
            continue;
        }

        let slug = match path.file_name().and_then(|s| s.to_str()) {
            Some(name) => name.to_string(),
            None => continue,
        };

        let md = fs::read_to_string(&skill_md)?;
        let (name, description) = parse_skill_md(&md, &slug);
        let real = path.canonicalize()?;
        let id = hash_realpath(&real)?;
        let mtime = fs::metadata(&skill_md)
            .and_then(|m| m.modified())
            .ok()
            .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
            .map(|d| d.as_secs() as i64)
            .unwrap_or(0);

        skills.push(Skill {
            id,
            slug,
            name,
            description,
            path: path.to_string_lossy().to_string(),
            realpath: real.to_string_lossy().to_string(),
            enabled: true,
            skill_mtime: mtime,
        });
    }
    Ok(skills)
}

pub fn skills_root() -> std::io::Result<std::path::PathBuf> {
    let home = std::env::var("HOME")
        .map_err(|_| std::io::Error::new(std::io::ErrorKind::NotFound, "HOME not set"))?;
    Ok(std::path::PathBuf::from(home).join(".codex").join("skills"))
}

#[cfg(test)]
mod tests;
#[cfg(test)]
mod tests_parse;
#[cfg(test)]
mod tests_scan;
