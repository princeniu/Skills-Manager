# Codex Skills Manager (MVP)

A local macOS Tauri app to inspect and manage Codex skills.

## MVP Behavior

- **Scan rule**: Only directories containing `SKILL.md` are treated as skills.
- **Enablement**: Skills are enabled by default. A skill is disabled only if `~/.codex/config.toml` contains a `[[skills.config]]` entry with `enabled = false` for that path.
- **Config edits**: Minimal-edit strategy. Only the matching `[[skills.config]]` entry is added/updated/removed. Other sections and entries are untouched.
- **Restart required**: Changes require restarting Codex to apply. The UI shows a “重启 Codex 生效” notice after toggles.
- **Delete**: Deletes move the skill folder to system Trash and clean any matching config entry.

## Notes

- Config file path: `~/.codex/config.toml`
- Skills directory: `~/.codex/skills/`
