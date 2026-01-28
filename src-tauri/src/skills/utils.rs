use sha2::{Digest, Sha256};
use std::path::Path;

pub fn hash_realpath(path: &Path) -> std::io::Result<String> {
    let real = path.canonicalize()?;
    let mut hasher = Sha256::new();
    hasher.update(real.to_string_lossy().as_bytes());
    let digest = hasher.finalize();
    Ok(format!("{:x}", digest))
}

pub fn parse_skill_md(md: &str, slug: &str) -> (String, String) {
    let mut name = slug.to_string();
    let mut found_title = false;
    let mut before_title: Vec<String> = Vec::new();
    let mut after_title: Vec<String> = Vec::new();

    for line in md.lines() {
        let trimmed = line.trim();
        if !found_title && trimmed.starts_with('#') {
            found_title = true;
            let candidate = trimmed.trim_start_matches('#').trim();
            if !candidate.is_empty() {
                name = candidate.to_string();
            }
            continue;
        }
        if found_title {
            after_title.push(line.to_string());
        } else {
            before_title.push(line.to_string());
        }
    }

    let body_lines = if found_title { after_title } else { before_title };
    let mut desc_lines = Vec::new();
    let mut in_paragraph = false;
    for line in body_lines {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            if in_paragraph {
                break;
            }
            continue;
        }
        in_paragraph = true;
        desc_lines.push(trimmed.to_string());
    }

    let mut description = desc_lines.join("\n");
    if description.len() > 280 {
        description.truncate(280);
    }

    (name, description)
}
