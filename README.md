# Skills Manager

A local macOS app to scan, inspect, and manage agent skill registries across toolchains.

[中文 README](./README_ZH.md)

## Highlights

- **Local-first**: Scans only on your machine. No network required.
- **Safe enable/disable**: Default enabled; disables via config entries only.
- **Minimal config edits**: Updates only the exact `[[skills.config]]` block.
- **Safe delete**: Moves skill folders to system Trash and cleans config entries.
- **Common paths**: Auto-detects well-known skill locations.

## Quick Start

```bash
npm install
npm run tauri dev
```

## First Launch

1. Open **Settings**.
2. Click **Browse** to select your skills folder or use **Auto Detect**.
3. The app shows how many skills were found and the last update time.
4. Click **Done** to load the list.

Auto-detect checks common locations:
- `~/.claude/skills/`
- `~/.gemini/skills/`
- `~/.agent/skills/`
- `~/.cursor/skills/`
- `~/.codex/skills/`

## Behavior

- **Scan rule**: Only directories containing `SKILL.md` are treated as skills.
- **Enablement**: Enabled by default; disabled only when `enabled = false` exists.
- **Config edits**: Minimal-edit strategy for the target block only.
- **Restart required**: Enable/disable requires app restart to apply.
- **Delete**: Moves to Trash and cleans any matching config entry.

## Configuration

| Item | Description | Default |
|------|-------------|---------|
| Skills Root Path | Folder containing skill subfolders | Set in Settings |
| Config Path | Where enable/disable is stored | `~/.codex/config.toml` |

## Troubleshooting

- **No skills found**: Ensure subfolders contain `SKILL.md`.
- **Read error**: The path may be missing or inaccessible.
- **Changes not applied**: Restart the app after toggles.

## Build

```bash
npm run tauri build
```

## License

MIT
