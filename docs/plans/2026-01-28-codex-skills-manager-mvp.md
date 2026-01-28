# Codex Skills Manager MVP Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a local macOS Tauri app that lists Codex skills, shows metadata, supports search/sort, and enables/ disables/ deletes skills safely.

**Architecture:** Tauri app with Rust backend commands handling file system access (scan skills, read/write config, Trash delete) and a lightweight web UI for display and interaction. Skill state is derived from `~/.codex/skills` and `~/.codex/config.toml` with minimal-edit config updates.

**Tech Stack:** Tauri + Rust (backend commands), Vite + TypeScript (frontend), minimal CSS; Rust crates: `toml_edit` (or custom block replace), `sha2`, `walkdir`, `trash`, `regex`.

---

### Task 1: Scaffold the project

**Files:**
- Create: `/Users/prince/Desktop/Codex-Skills-Manager/` (project root)
- Create: `/Users/prince/Desktop/Codex-Skills-Manager/src/` (frontend)
- Create: `/Users/prince/Desktop/Codex-Skills-Manager/src-tauri/` (backend)

**Step 1: Initialize the frontend (Vite + TS)**
Run: `npm create vite@latest Codex-Skills-Manager -- --template vanilla-ts`
Expected: Vite project created under `/Users/prince/Desktop/Codex-Skills-Manager`

**Step 2: Initialize Tauri**
Run: `cd /Users/prince/Desktop/Codex-Skills-Manager && npm install`
Run: `cd /Users/prince/Desktop/Codex-Skills-Manager && npx tauri init --app-name "Codex Skills Manager" --window-title "Codex Skills Manager"`
Expected: `src-tauri/` directory created

**Step 3: Commit**
```bash
git init

git add .
git commit -m "chore: scaffold tauri app"
```

---

### Task 2: Define Rust data model and helpers

**Files:**
- Create: `/Users/prince/Desktop/Codex-Skills-Manager/src-tauri/src/skills/mod.rs`
- Create: `/Users/prince/Desktop/Codex-Skills-Manager/src-tauri/src/skills/types.rs`
- Create: `/Users/prince/Desktop/Codex-Skills-Manager/src-tauri/src/skills/utils.rs`

**Step 1: Write a failing unit test for ID generation**
Create `/Users/prince/Desktop/Codex-Skills-Manager/src-tauri/src/skills/tests.rs`:
```rust
#[test]
fn id_is_sha256_hex_of_realpath() {
    let path = "/tmp/example";
    let real = "/tmp/example";
    let id = crate::skills::utils::hash_realpath(real);
    assert_eq!(id.len(), 64);
}
```

**Step 2: Run test to verify it fails**
Run: `cd /Users/prince/Desktop/Codex-Skills-Manager/src-tauri && cargo test -q`
Expected: FAIL due to missing module/functions

**Step 3: Implement minimal data types and helpers**
Implement in `types.rs`:
```rust
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
```
Implement in `utils.rs`:
```rust
pub fn hash_realpath(realpath: &str) -> String { /* sha256 hex */ }
```

**Step 4: Run test to verify it passes**
Run: `cd /Users/prince/Desktop/Codex-Skills-Manager/src-tauri && cargo test -q`
Expected: PASS

**Step 5: Commit**
```bash
git add src-tauri/src/skills
git commit -m "feat: add skill model and hashing helper"
```

---

### Task 3: Implement SKILL.md parsing (simple rules)

**Files:**
- Modify: `/Users/prince/Desktop/Codex-Skills-Manager/src-tauri/src/skills/utils.rs`
- Create: `/Users/prince/Desktop/Codex-Skills-Manager/src-tauri/src/skills/tests_parse.rs`

**Step 1: Write failing test for name/description parsing**
```rust
#[test]
fn parse_skill_md_extracts_title_and_first_paragraph() {
    let md = "# My Skill\n\nFirst paragraph.\n\nSecond paragraph.";
    let (name, desc) = crate::skills::utils::parse_skill_md(md);
    assert_eq!(name, "My Skill");
    assert_eq!(desc, "First paragraph.");
}
```

**Step 2: Run test to verify it fails**
Run: `cd /Users/prince/Desktop/Codex-Skills-Manager/src-tauri && cargo test -q`
Expected: FAIL

**Step 3: Implement minimal parser**
- name = first `# ...` line if present
- description = first non-empty paragraph after title, truncate to 300 chars

**Step 4: Run test to verify it passes**
Run: `cd /Users/prince/Desktop/Codex-Skills-Manager/src-tauri && cargo test -q`
Expected: PASS

**Step 5: Commit**
```bash
git add src-tauri/src/skills

git commit -m "feat: parse SKILL.md metadata"
```

---

### Task 4: Implement skills scanning

**Files:**
- Modify: `/Users/prince/Desktop/Codex-Skills-Manager/src-tauri/src/skills/mod.rs`
- Create: `/Users/prince/Desktop/Codex-Skills-Manager/src-tauri/src/skills/tests_scan.rs`

**Step 1: Write failing test for scan (mock directory)**
```rust
#[test]
fn scan_only_includes_dirs_with_skill_md() {
    // create temp dirs: a/ (with SKILL.md), b/ (no SKILL.md)
    // expect only a/ included
}
```

**Step 2: Run test to verify it fails**
Run: `cd /Users/prince/Desktop/Codex-Skills-Manager/src-tauri && cargo test -q`
Expected: FAIL

**Step 3: Implement scan_skills(root_path)**
- Walk directories under `~/.codex/skills`
- Only include directories that contain `SKILL.md`
- Compute realpath, id, slug, mtime, name/description

**Step 4: Run test to verify it passes**
Run: `cd /Users/prince/Desktop/Codex-Skills-Manager/src-tauri && cargo test -q`
Expected: PASS

**Step 5: Commit**
```bash
git add src-tauri/src/skills

git commit -m "feat: scan skills directory"
```

---

### Task 5: Implement config reading + minimal edit writing

**Files:**
- Create: `/Users/prince/Desktop/Codex-Skills-Manager/src-tauri/src/config/mod.rs`
- Create: `/Users/prince/Desktop/Codex-Skills-Manager/src-tauri/src/config/patch.rs`
- Create: `/Users/prince/Desktop/Codex-Skills-Manager/src-tauri/src/config/tests.rs`

**Step 1: Write failing tests for config patching**
```rust
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
```

**Step 2: Run test to verify it fails**
Run: `cd /Users/prince/Desktop/Codex-Skills-Manager/src-tauri && cargo test -q`
Expected: FAIL

**Step 3: Implement minimal-edit patcher**
- Parse file as raw text
- Identify `[[skills.config]]` blocks
- Match by `realpath` (normalize entry path)
- For disable: update existing block or append new block
- For enable: remove block entirely
- Preserve unrelated sections + formatting

**Step 4: Run test to verify it passes**
Run: `cd /Users/prince/Desktop/Codex-Skills-Manager/src-tauri && cargo test -q`
Expected: PASS

**Step 5: Commit**
```bash
git add src-tauri/src/config

git commit -m "feat: minimal edit config patcher"
```

---

### Task 6: Implement backend commands

**Files:**
- Modify: `/Users/prince/Desktop/Codex-Skills-Manager/src-tauri/src/main.rs`
- Modify: `/Users/prince/Desktop/Codex-Skills-Manager/src-tauri/src/skills/mod.rs`
- Modify: `/Users/prince/Desktop/Codex-Skills-Manager/src-tauri/src/config/mod.rs`

**Step 1: Write failing integration test (optional)**
If no integration tests, skip and rely on unit tests.

**Step 2: Implement commands**
- `list_skills()`
- `set_enabled(skill_realpath, enabled)`
- `delete_skill(skill_realpath)` (Trash + config cleanup)
- `get_config_fingerprint()`

**Step 3: Run tests**
Run: `cd /Users/prince/Desktop/Codex-Skills-Manager/src-tauri && cargo test -q`
Expected: PASS

**Step 4: Commit**
```bash
git add src-tauri

git commit -m "feat: backend commands"
```

---

### Task 7: Implement frontend UI

**Files:**
- Modify: `/Users/prince/Desktop/Codex-Skills-Manager/src/main.ts`
- Modify: `/Users/prince/Desktop/Codex-Skills-Manager/src/style.css`
- Create: `/Users/prince/Desktop/Codex-Skills-Manager/src/ui/app.ts`

**Step 1: Implement UI shell**
- Search input
- Sort dropdown (name/enabled)
- Skill list with status
- Detail panel

**Step 2: Wire Tauri commands**
- Invoke `list_skills` on load
- Invoke `set_enabled` and `delete_skill` with confirm dialogs
- Show “重启 Codex 生效” notice

**Step 3: Add refresh logic**
- Poll fingerprint every N seconds (e.g., 5s)
- If changed, refresh list

**Step 4: Manual smoke check**
Run: `cd /Users/prince/Desktop/Codex-Skills-Manager && npm run tauri dev`
Expected: App opens and list renders

**Step 5: Commit**
```bash
git add src

git commit -m "feat: minimal UI for skills manager"
```

---

### Task 8: Add guardrails and error handling

**Files:**
- Modify: `/Users/prince/Desktop/Codex-Skills-Manager/src-tauri/src/skills/mod.rs`
- Modify: `/Users/prince/Desktop/Codex-Skills-Manager/src-tauri/src/config/mod.rs`
- Modify: `/Users/prince/Desktop/Codex-Skills-Manager/src/ui/app.ts`

**Step 1: Add delete path safety**
- Only allow Trash when `realpath` starts with `~/.codex/skills/`

**Step 2: Add failure rollback messages**
- If Trash succeeds but config cleanup fails: surface error
- If config cleanup succeeds but Trash fails: surface error

**Step 3: Manual smoke check**
Run: `npm run tauri dev`
Expected: errors are shown in UI

**Step 4: Commit**
```bash
git add src-tauri src

git commit -m "feat: safety checks and error reporting"
```

---

### Task 9: Document MVP behavior

**Files:**
- Create: `/Users/prince/Desktop/Codex-Skills-Manager/README.md`

**Step 1: Write README**
Include:
- Scan rule (only directories with SKILL.md)
- Enabled default true (disabled only if config has enabled=false)
- Config minimal-edit strategy (local block replacement)
- “重启 Codex 生效” notice
- Delete = system Trash + config cleanup

**Step 2: Commit**
```bash
git add README.md

git commit -m "docs: document MVP rules"
```

---

## Plan complete and saved to `docs/plans/2026-01-28-codex-skills-manager-mvp.md`.
Two execution options:

1. Subagent-Driven (this session) — I dispatch fresh subagent per task, review between tasks, fast iteration
2. Parallel Session (separate) — Open new session with executing-plans, batch execution with checkpoints

Which approach?
