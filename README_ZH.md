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
  本地 macOS 应用：用于扫描、查看并安全管理不同工具链的技能库（Skill Registry）。
</p>

<p align="center">
  <a href="./README.md">English README</a>
</p>

---

## 核心亮点

- **本地优先**：全部在本机完成扫描与管理。
- **安全启用/禁用**：默认启用，仅通过配置项禁用。
- **最小化配置写入**：只编辑目标 `[[skills.config]]` block。
- **安全删除**：删除走系统废纸篓并同步清理配置项。
- **常见路径适配**：自动检测常用技能目录。

## 快速开始

```bash
npm install
npm run tauri dev
```

## 首次使用

1. 打开 **Settings**。
2. 点击 **Browse** 选择技能目录，或使用 **Auto Detect** 自动检测。
3. 页面会显示已发现的技能数量和更新时间。
4. 点击 **Done** 加载列表。

自动检测路径：
- `~/.claude/skills/`
- `~/.gemini/skills/`
- `~/.agent/skills/`
- `~/.cursor/skills/`
- `~/.codex/skills/`

## 行为说明

- **扫描规则**：仅包含 `SKILL.md` 的目录视为技能。
- **启用默认**：仅当存在 `enabled = false` 时视为禁用。
- **配置策略**：采用最小编辑策略，仅修改目标 block。
- **生效方式**：启用/禁用后需重启应用生效。
- **删除策略**：移动到系统废纸篓并清理对应配置项。

## 配置

| 项目 | 说明 | 默认 |
|------|------|------|
| Skills Root Path | 技能目录所在文件夹 | 在 Settings 中设置 |
| Config Path | 启用/禁用的配置路径 | `~/.codex/config.toml` |

## 常见问题

- **未发现技能**：确认目录下有包含 `SKILL.md` 的子目录。
- **读取失败**：检查路径是否存在或权限是否允许访问。
- **改动未生效**：启用/禁用后重启应用。

## 构建

```bash
npm run tauri build
```

## License

MIT
