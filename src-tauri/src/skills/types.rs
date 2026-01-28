#[derive(Clone, Debug, serde::Serialize)]
pub struct Skill {
    pub id: String,
    pub slug: String,
    pub name: String,
    pub description: String,
    pub path: String,
    pub realpath: String,
    pub enabled: bool,
    pub skill_mtime: i64,
}
