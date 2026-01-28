#[test]
fn disable_adds_entry_if_missing() {
    let original = "model = \"gpt-5.2-codex\"\n";
    let updated = crate::config::patch::set_enabled(original, "/real/path", false);
    assert!(updated.contains("[[skills.config]]"));
    assert!(updated.contains("enabled = false"));
}

#[test]
fn enable_removes_entry() {
    let original = "[[skills.config]]\npath = \"/real/path\"\nenabled = false\n";
    let updated = crate::config::patch::set_enabled(original, "/real/path", true);
    assert!(!updated.contains("/real/path"));
}
