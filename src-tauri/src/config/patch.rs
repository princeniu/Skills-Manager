pub(crate) fn extract_path_value(line: &str) -> Option<String> {
    let trimmed = line.trim();
    if !trimmed.starts_with("path") {
        return None;
    }
    let first = trimmed.find('"')?;
    let last = trimmed.rfind('"')?;
    if last <= first {
        return None;
    }
    Some(trimmed[first + 1..last].to_string())
}

fn block_has_path(block: &[String], realpath: &str) -> bool {
    let target = super::normalize_path(realpath);
    for line in block {
        if let Some(value) = extract_path_value(line) {
            let candidate = super::normalize_path(&value);
            if candidate == target {
                return true;
            }
        }
    }
    false
}

fn ensure_enabled_false(block: &[String]) -> Vec<String> {
    let mut out = Vec::new();
    let mut updated = false;
    for line in block {
        let trimmed = line.trim();
        if trimmed.starts_with("enabled") {
            out.push("enabled = false".to_string());
            updated = true;
        } else {
            out.push(line.clone());
        }
    }
    if !updated {
        out.push("enabled = false".to_string());
    }
    out
}

pub fn set_enabled(original: &str, realpath: &str, enabled: bool) -> String {
    let mut segments: Vec<Vec<String>> = Vec::new();
    let mut segment_is_block: Vec<bool> = Vec::new();

    let mut current: Vec<String> = Vec::new();
    let mut in_block = false;

    for line in original.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with("[[") {
            if !current.is_empty() || !segments.is_empty() {
                segments.push(current);
                segment_is_block.push(in_block);
            }
            current = Vec::new();
            in_block = trimmed == "[[skills.config]]";
            current.push(line.to_string());
            continue;
        }
        current.push(line.to_string());
    }
    if !current.is_empty() || original.is_empty() {
        segments.push(current);
        segment_is_block.push(in_block);
    }

    let mut out: Vec<String> = Vec::new();
    let mut found = false;

    for (idx, segment) in segments.iter().enumerate() {
        if segment_is_block[idx] && block_has_path(segment, realpath) {
            found = true;
            if enabled {
                continue;
            }
            let updated = ensure_enabled_false(segment);
            out.extend(updated);
            continue;
        }
        out.extend(segment.iter().cloned());
    }

    if !enabled && !found {
        if !out.is_empty() {
            out.push(String::new());
        }
        out.push("[[skills.config]]".to_string());
        out.push(format!("path = \"{}\"", realpath));
        out.push("enabled = false".to_string());
    }

    let mut result = out.join("\n");
    if !result.ends_with('\n') {
        result.push('\n');
    }
    result
}
