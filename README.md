<p align="center">
  <img src="./public/brand/icon.png" alt="Skills Manager" width="96" height="96" />
</p>

<h1 align="center">Skills Manager</h1>

<p align="center">
  <a href="https://img.shields.io/badge/platform-macOS-2A3037?style=flat&labelColor=1B1F24">
    <img alt="platform" src="https://img.shields.io/badge/platform-macOS-2A3037?style=flat&labelColor=1B1F24" />
  </a>
  <a href="https://img.shields.io/badge/tauri-v2-5B7CFA?style=flat&labelColor=1B1F24">
    <img alt="tauri" src="https://img.shields.io/badge/tauri-v2-5B7CFA?style=flat&labelColor=1B1F24" />
  </a>
  <a href="./LICENSE">
    <img alt="license" src="https://img.shields.io/badge/license-MIT-5CCF8D?style=flat&labelColor=1B1F24" />
  </a>
</p>

<p align="center">
  A local macOS app to scan, inspect, and manage agent skill registries across toolchains.
</p>

<p align="center">
  <a href="./README_ZH.md">中文 README</a>
</p>

---

## Highlights

- **Local-first**: Scans only on your machine. No network required.
- **Safe enable/disable**: Default enabled; disables via config entries only.
- **Minimal config edits**: Updates only the exact `[[skills.config]]` block.
- **Safe delete**: Moves skill folders to system Trash and cleans config entries.
- **Common paths**: Auto-detects well-known skill locations.


## Demo Video (9:16)

<p align="center">
  <video src="./public/media/promo-9x16.mp4" controls muted playsinline width="320"></video>
</p>

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

## Roadmap

- **Multi-root support**: manage multiple skills folders in one app.
- **Tag system**: user-defined tags, filters, and tag management.
- **Export & backup**: export skills metadata and backup/restore configs.
- **Batch operations**: enable/disable/delete in bulk with safety prompts.
- **Workspace profiles**: switch between different toolchains quickly.

## License

MIT
