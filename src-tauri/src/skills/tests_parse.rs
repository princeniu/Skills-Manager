#[test]
fn parse_skill_md_extracts_title_and_first_paragraph() {
    let md = "# My Skill\n\nFirst paragraph.\n\nSecond paragraph.";
    let (name, desc) = crate::skills::utils::parse_skill_md(md, "my-skill");
    assert_eq!(name, "My Skill");
    assert_eq!(desc, "First paragraph.");
}

#[test]
fn parse_skill_md_no_title_uses_slug() {
    let md = "First paragraph.\n\nSecond paragraph.";
    let (name, desc) = crate::skills::utils::parse_skill_md(md, "my-skill");
    assert_eq!(name, "my-skill");
    assert_eq!(desc, "First paragraph.");
}

#[test]
fn parse_skill_md_empty_is_blank() {
    let md = " \n\n  \n";
    let (name, desc) = crate::skills::utils::parse_skill_md(md, "my-skill");
    assert_eq!(name, "my-skill");
    assert_eq!(desc, "");
}

#[test]
fn parse_skill_md_truncates_description() {
    let long = "a".repeat(400);
    let md = format!("# Title\n\n{long}");
    let (_name, desc) = crate::skills::utils::parse_skill_md(&md, "slug");
    assert_eq!(desc.len(), 280);
}
