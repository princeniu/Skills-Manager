#[test]
fn parse_skill_md_extracts_title_and_first_paragraph() {
    let md = "# My Skill\n\nFirst paragraph.\n\nSecond paragraph.";
    let (name, desc) = crate::skills::utils::parse_skill_md(md);
    assert_eq!(name, "My Skill");
    assert_eq!(desc, "First paragraph.");
}
