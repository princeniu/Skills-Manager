use sha2::{Digest, Sha256};

pub fn hash_realpath(realpath: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(realpath.as_bytes());
    let digest = hasher.finalize();
    format!("{:x}", digest)
}

pub fn parse_skill_md(md: &str) -> (String, String) {
    let mut lines = md.lines();
    let mut name = String::new();
    let mut after_title = Vec::new();

    while let Some(line) = lines.next() {
        let trimmed = line.trim();
        if trimmed.starts_with('#') {
            name = trimmed.trim_start_matches('#').trim().to_string();
            after_title.extend(lines.map(|l| l.to_string()));
            break;
        }
    }

    let mut desc_lines = Vec::new();
    let mut in_paragraph = false;
    for line in after_title {
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
    if description.len() > 300 {
        description.truncate(300);
    }

    (name, description)
}
