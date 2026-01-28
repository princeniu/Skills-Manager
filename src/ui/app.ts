import { invoke, isTauri } from '@tauri-apps/api/core'

export type Skill = {
  id: string
  slug: string
  name: string
  description: string
  path: string
  realpath: string
  enabled: boolean
  skill_mtime: number
}

type SortKey = 'name' | 'enabled'

type AppState = {
  skills: Skill[]
  query: string
  sortKey: SortKey
  selectedId: string | null
  fingerprint: string
}

const REFRESH_INTERVAL_MS = 5000

export function mountApp(root: HTMLElement) {
  root.innerHTML = `
    <div class="app-shell">
      <header class="topbar">
        <div class="brand">
          <div class="brand-mark">CS</div>
          <div>
            <div class="brand-title">Codex Skills Manager</div>
            <div class="brand-subtitle">Local skill registry • Tauri desktop</div>
          </div>
        </div>
        <div class="topbar-actions">
          <div class="notice" id="restartNotice" hidden>
            重启 Codex 生效
          </div>
          <button class="ghost" id="refreshBtn">Refresh</button>
        </div>
      </header>

      <section class="toolbar">
        <div class="search">
          <span class="search-icon">⌕</span>
          <input id="searchInput" type="search" placeholder="Search skills by name, slug, description" />
        </div>
        <div class="sorter">
          <label for="sortSelect">Sort</label>
          <select id="sortSelect">
            <option value="name">Name (A–Z)</option>
            <option value="enabled">Enabled first</option>
          </select>
        </div>
      </section>
      <div class="alert-bar" id="alertBar" hidden></div>

      <main class="content">
        <aside class="list-panel">
          <div class="list-meta" id="listMeta"></div>
          <div class="skill-list" id="skillList"></div>
        </aside>
        <section class="detail-panel">
          <div id="detailEmpty" class="detail-empty">
            <div class="empty-mark">✦</div>
            <div class="empty-title">Select a skill</div>
            <div class="empty-subtitle">Inspect metadata, toggle enablement, or delete safely.</div>
          </div>
          <div id="detailView" class="detail-view" hidden></div>
        </section>
      </main>

      <footer class="statusbar">
        <div id="statusText">Ready</div>
        <div class="status-meta" id="statusMeta"></div>
      </footer>
    </div>
  `

  const state: AppState = {
    skills: [],
    query: '',
    sortKey: 'name',
    selectedId: null,
    fingerprint: ''
  }

  const searchInput = root.querySelector<HTMLInputElement>('#searchInput')!
  const sortSelect = root.querySelector<HTMLSelectElement>('#sortSelect')!
  const skillList = root.querySelector<HTMLDivElement>('#skillList')!
  const listMeta = root.querySelector<HTMLDivElement>('#listMeta')!
  const detailView = root.querySelector<HTMLDivElement>('#detailView')!
  const detailEmpty = root.querySelector<HTMLDivElement>('#detailEmpty')!
  const statusText = root.querySelector<HTMLDivElement>('#statusText')!
  const statusMeta = root.querySelector<HTMLDivElement>('#statusMeta')!
  const restartNotice = root.querySelector<HTMLDivElement>('#restartNotice')!
  const refreshBtn = root.querySelector<HTMLButtonElement>('#refreshBtn')!
  const alertBar = root.querySelector<HTMLDivElement>('#alertBar')!
  const isTauriEnv = isTauri()

  searchInput.addEventListener('input', () => {
    state.query = searchInput.value.trim().toLowerCase()
    render()
  })

  sortSelect.addEventListener('change', () => {
    state.sortKey = sortSelect.value as SortKey
    render()
  })

  refreshBtn.addEventListener('click', () => {
    void refreshSkills(true)
  })

  async function refreshSkills(showStatus = false) {
    try {
      if (!isTauriEnv) {
        setError('This view is for Tauri only. Please open via `npm run tauri dev`.')
        return
      }
      if (showStatus) setStatus('Refreshing…')
      const items = await invoke<Skill[]>('list_skills')
      state.skills = items
      if (!state.selectedId && items.length > 0) {
        state.selectedId = items[0].id
      } else if (state.selectedId && !items.find((s) => s.id === state.selectedId)) {
        state.selectedId = items.length ? items[0].id : null
      }
      setStatus('Ready')
      render()
    } catch (err) {
      setError(`List failed: ${formatError(err)}`)
    }
  }

  async function pollFingerprint() {
    try {
      if (!isTauriEnv) {
        return
      }
      const fp = await invoke<string>('get_config_fingerprint')
      if (state.fingerprint !== fp) {
        state.fingerprint = fp
        await refreshSkills(false)
      }
    } catch (err) {
      setError(`Config read failed: ${formatError(err)}`)
    }
  }

  function getFilteredSkills() {
    const query = state.query
    let filtered = state.skills
    if (query) {
      filtered = filtered.filter((skill) => {
        const hay = `${skill.name} ${skill.slug} ${skill.description}`.toLowerCase()
        return hay.includes(query)
      })
    }

    const sorted = [...filtered]
    if (state.sortKey === 'enabled') {
      sorted.sort((a, b) => Number(b.enabled) - Number(a.enabled) || a.slug.localeCompare(b.slug))
    } else {
      sorted.sort((a, b) => a.name.localeCompare(b.name))
    }

    return sorted
  }

  function render() {
    const filtered = getFilteredSkills()
    const enabledCount = state.skills.filter((s) => s.enabled).length

    listMeta.textContent = `${filtered.length} shown · ${enabledCount}/${state.skills.length} enabled`

    skillList.innerHTML = filtered
      .map((skill) => {
        const selected = skill.id === state.selectedId
        const status = skill.enabled ? 'enabled' : 'disabled'
        return `
          <button class="skill-card ${selected ? 'selected' : ''}" data-id="${skill.id}">
            <div class="skill-title">${escapeHtml(skill.name)}</div>
            <div class="skill-desc">${escapeHtml(skill.description || 'No description')}</div>
            <div class="skill-meta">
              <span class="pill ${status}">${status}</span>
              <span class="slug">${escapeHtml(skill.slug)}</span>
            </div>
          </button>
        `
      })
      .join('')

    skillList.querySelectorAll<HTMLButtonElement>('.skill-card').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.selectedId = btn.dataset.id || null
        renderDetail()
        render()
      })
    })

    renderDetail()
    statusMeta.textContent = state.fingerprint ? `config: ${state.fingerprint.slice(0, 10)}…` : 'config: empty'
  }

  function renderDetail() {
    const selected = state.skills.find((s) => s.id === state.selectedId) || null
    if (!selected) {
      detailView.hidden = true
      detailEmpty.hidden = false
      return
    }

    detailEmpty.hidden = true
    detailView.hidden = false

    const status = selected.enabled ? 'enabled' : 'disabled'
    detailView.innerHTML = `
      <div class="detail-header">
        <div>
          <div class="detail-title">${escapeHtml(selected.name)}</div>
          <div class="detail-sub">${escapeHtml(selected.slug)}</div>
        </div>
        <div class="pill ${status}">${status}</div>
      </div>
      <div class="detail-description">${escapeHtml(selected.description || 'No description found in SKILL.md.')}</div>
      <div class="detail-actions">
        <button class="primary" id="toggleBtn">${selected.enabled ? 'Disable' : 'Enable'}</button>
        <button class="danger" id="deleteBtn">Delete</button>
      </div>
      <div class="detail-grid">
        <div class="detail-item">
          <div class="detail-label">Real Path</div>
          <div class="detail-value">${escapeHtml(selected.realpath)}</div>
        </div>
        <div class="detail-item">
          <div class="detail-label">Path</div>
          <div class="detail-value">${escapeHtml(selected.path)}</div>
        </div>
        <div class="detail-item">
          <div class="detail-label">Skill ID</div>
          <div class="detail-value mono">${escapeHtml(selected.id)}</div>
        </div>
        <div class="detail-item">
          <div class="detail-label">Last Modified</div>
          <div class="detail-value">${formatDate(selected.skill_mtime)}</div>
        </div>
      </div>
    `

    const toggleBtn = detailView.querySelector<HTMLButtonElement>('#toggleBtn')!
    const deleteBtn = detailView.querySelector<HTMLButtonElement>('#deleteBtn')!

    toggleBtn.addEventListener('click', async () => {
      try {
        setStatus(selected.enabled ? 'Disabling…' : 'Enabling…')
        const result = await invoke<string>('set_enabled', {
          skillRealpath: selected.realpath,
          enabled: !selected.enabled
        })
        if (result) {
          restartNotice.hidden = false
        }
        await refreshSkills(false)
        setStatus('Ready')
      } catch (err) {
        setError(`Toggle failed: ${formatError(err)}`)
      }
    })

    deleteBtn.addEventListener('click', async () => {
      const confirmed = confirm(`Delete ${selected.name}? This moves it to Trash.`)
      if (!confirmed) return
      try {
        setStatus('Deleting…')
        await invoke('delete_skill', { skillRealpath: selected.realpath })
        await refreshSkills(false)
        setStatus('Ready')
      } catch (err) {
        setError(`Delete failed: ${formatError(err)}`)
      }
    })
  }

  function setStatus(text: string) {
    statusText.textContent = text
    statusText.dataset.state = 'info'
    alertBar.hidden = true
  }

  function setError(text: string) {
    statusText.textContent = text
    statusText.dataset.state = 'error'
    alertBar.textContent = text
    alertBar.hidden = false
  }

  function formatDate(epochSeconds: number) {
    if (!epochSeconds) return '—'
    const date = new Date(epochSeconds * 1000)
    return date.toLocaleString()
  }

  function formatError(err: unknown) {
    if (typeof err === 'string') return err
    if (err instanceof Error) return err.message
    return JSON.stringify(err)
  }

  function escapeHtml(value: string) {
    return value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;')
  }

  void refreshSkills(true)
  void pollFingerprint()
  if (isTauriEnv) {
    setInterval(() => void pollFingerprint(), REFRESH_INTERVAL_MS)
  }
}
