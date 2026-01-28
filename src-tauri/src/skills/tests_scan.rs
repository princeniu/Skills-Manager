use std::fs;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

fn make_temp_dir(name: &str) -> PathBuf {
    let mut base = std::env::temp_dir();
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_nanos();
    base.push(format!("codex-skills-scan-{}-{}-{}", name, std::process::id(), nanos));
    fs::create_dir_all(&base).unwrap();
    base
}

#[test]
fn scan_only_includes_dirs_with_skill_md() {
    let root = make_temp_dir("root");
    let skill_a = root.join("skillA");
    let skill_b = root.join("skillB");

    fs::create_dir_all(&skill_a).unwrap();
    fs::create_dir_all(&skill_b).unwrap();
    fs::write(skill_a.join("SKILL.md"), "# Skill A\n\nFirst paragraph.").unwrap();
    fs::write(root.join(".DS_Store"), "").unwrap();

    let mut skills = crate::skills::scan_skills(&root).unwrap();
    skills.sort_by(|a, b| a.slug.cmp(&b.slug));

    assert_eq!(skills.len(), 1);
    assert_eq!(skills[0].slug, "skillA");
    assert_eq!(skills[0].name, "Skill A");
    assert_eq!(skills[0].description, "First paragraph.");

    let _ = fs::remove_dir_all(&root);
}
