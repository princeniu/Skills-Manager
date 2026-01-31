# Skills Manager

A local macOS Tauri app to inspect and manage skills across common agent toolchains.

## Behavior

- **Scan rule**: Only directories containing `SKILL.md` are treated as skills.
- **Enablement**: Skills are enabled by default. A skill is disabled only if `~/.codex/config.toml` contains a `[[skills.config]]` entry with `enabled = false` for that path.
- **Config edits**: Minimal-edit strategy. Only the matching `[[skills.config]]` entry is added/updated/removed. Other sections and entries are untouched.
- **Restart required**: Changes require restarting the app to apply. The UI shows a notice after toggles.
- **Delete**: Deletes move the skill folder to system Trash and clean any matching config entry.

## Quickstart

```bash
npm install
npm run tauri dev
```

## First Launch

1. Open **Settings**.
2. Click **Browse** to pick your skills folder, or use **Auto Detect**.
3. The app shows how many skills were found and the latest update time.
4. Click **Done** to load the list.

Auto detect checks common locations:
- `~/.claude/skills/`
- `~/.gemini/skills/`
- `~/.agent/skills/`
- `~/.cursor/skills/`
- `~/.codex/skills/`

## Troubleshooting

- **“No skills found”**: Ensure your folder contains subfolders with `SKILL.md`.
- **Read error**: The selected folder may be missing or inaccessible.
- **Changes not applied**: Restart the app after enable/disable changes.

## Build

```bash
npm run tauri build
```

## Notes

- Config file path: `~/.codex/config.toml`
- Skills root path is user-configurable in Settings
