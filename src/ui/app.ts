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

type SortKey = 'name' | 'enabled' | 'mtime'

type AppState = {
  skills: Skill[]
  query: string
  sortKey: SortKey
  selectedId: string | null
  selectedRealpath: string | null
  fingerprint: string
  groupByStatus: boolean
  statusFilter: 'all' | 'enabled' | 'disabled'
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
        <div class="toolbar-actions">
          <div class="sorter">
            <label for="sortSelect">Sort</label>
            <select id="sortSelect">
              <option value="name">Name (A–Z)</option>
              <option value="enabled">Enabled first</option>
              <option value="mtime">Recently modified</option>
            </select>
          </div>
          <div class="filter">
            <label for="statusFilter">Filter</label>
            <select id="statusFilter">
              <option value="all">All</option>
              <option value="enabled">Enabled</option>
              <option value="disabled">Disabled</option>
            </select>
          </div>
          <div class="toggle">
            <button class="toggle-btn" id="groupToggle" aria-pressed="false">Group</button>
          </div>
        </div>
      </section>
      <div class="alert-bar" id="alertBar" hidden></div>

      <main class="content">
        <aside class="sidebar">
          <div class="sidebar-title">Filters</div>
          <button class="side-item" data-filter="all" id="filterAll">
            <span>All skills</span>
            <span class="side-count" id="countAll">0</span>
          </button>
          <button class="side-item" data-filter="enabled" id="filterEnabled">
            <span>Enabled</span>
            <span class="side-count" id="countEnabled">0</span>
          </button>
          <button class="side-item" data-filter="disabled" id="filterDisabled">
            <span>Disabled</span>
            <span class="side-count" id="countDisabled">0</span>
          </button>
          <div class="sidebar-title">Sort</div>
          <button class="side-item" data-sort="mtime" id="sortRecent">
            <span>Recent changes</span>
          </button>
        </aside>
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

      <div class="toast" id="toast" hidden></div>

      <div class="modal-backdrop" id="confirmBackdrop" hidden>
        <div class="modal">
          <div class="modal-title" id="confirmTitle">Delete skill?</div>
          <div class="modal-body" id="confirmBody">This will move the folder to Trash.</div>
          <div class="modal-actions">
            <button class="ghost" id="confirmCancel">Cancel</button>
            <button class="danger" id="confirmOk">Delete</button>
          </div>
        </div>
      </div>
    </div>
  `

  const state: AppState = {
    skills: [],
    query: '',
    sortKey: 'name',
    selectedId: null,
    selectedRealpath: null,
    fingerprint: '',
    groupByStatus: false,
    statusFilter: 'all'
  }

  const searchInput = root.querySelector<HTMLInputElement>('#searchInput')!
  const sortSelect = root.querySelector<HTMLSelectElement>('#sortSelect')!
  const groupToggle = root.querySelector<HTMLButtonElement>('#groupToggle')!
  const statusFilter = root.querySelector<HTMLSelectElement>('#statusFilter')!
  const skillList = root.querySelector<HTMLDivElement>('#skillList')!
  const listMeta = root.querySelector<HTMLDivElement>('#listMeta')!
  const countAll = root.querySelector<HTMLSpanElement>('#countAll')!
  const countEnabled = root.querySelector<HTMLSpanElement>('#countEnabled')!
  const countDisabled = root.querySelector<HTMLSpanElement>('#countDisabled')!
  const filterAll = root.querySelector<HTMLButtonElement>('#filterAll')!
  const filterEnabled = root.querySelector<HTMLButtonElement>('#filterEnabled')!
  const filterDisabled = root.querySelector<HTMLButtonElement>('#filterDisabled')!
  const sortRecent = root.querySelector<HTMLButtonElement>('#sortRecent')!
  const detailView = root.querySelector<HTMLDivElement>('#detailView')!
  const detailEmpty = root.querySelector<HTMLDivElement>('#detailEmpty')!
  const statusText = root.querySelector<HTMLDivElement>('#statusText')!
  const statusMeta = root.querySelector<HTMLDivElement>('#statusMeta')!
  const restartNotice = root.querySelector<HTMLDivElement>('#restartNotice')!
  const refreshBtn = root.querySelector<HTMLButtonElement>('#refreshBtn')!
  const alertBar = root.querySelector<HTMLDivElement>('#alertBar')!
  const toast = root.querySelector<HTMLDivElement>('#toast')!
  const confirmBackdrop = root.querySelector<HTMLDivElement>('#confirmBackdrop')!
  const confirmTitle = root.querySelector<HTMLDivElement>('#confirmTitle')!
  const confirmBody = root.querySelector<HTMLDivElement>('#confirmBody')!
  const confirmCancel = root.querySelector<HTMLButtonElement>('#confirmCancel')!
  const confirmOk = root.querySelector<HTMLButtonElement>('#confirmOk')!
  const isTauriEnv = isTauri()

  searchInput.addEventListener('input', () => {
    state.query = searchInput.value.trim().toLowerCase()
    render()
  })

  sortSelect.addEventListener('change', () => {
    state.sortKey = sortSelect.value as SortKey
    render()
  })

  groupToggle.addEventListener('click', () => {
    state.groupByStatus = !state.groupByStatus
    groupToggle.setAttribute('aria-pressed', String(state.groupByStatus))
    groupToggle.classList.toggle('active', state.groupByStatus)
    render()
  })

  statusFilter.addEventListener('change', () => {
    state.statusFilter = statusFilter.value as AppState['statusFilter']
    render()
  })

  ;[filterAll, filterEnabled, filterDisabled].forEach((btn) => {
    btn.addEventListener('click', () => {
      state.statusFilter = (btn.dataset.filter as AppState['statusFilter']) || 'all'
      statusFilter.value = state.statusFilter
      render()
    })
  })

  sortRecent.addEventListener('click', () => {
    state.sortKey = 'mtime'
    sortSelect.value = 'mtime'
    render()
  })

  refreshBtn.addEventListener('click', () => {
    void refreshSkills(true)
  })

  window.addEventListener('keydown', (event) => {
    const target = event.target as HTMLElement | null
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
      return
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      moveSelection(1)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      moveSelection(-1)
    } else if (event.key === 'Enter') {
      event.preventDefault()
      void toggleSelected()
    }
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
      if (state.selectedRealpath) {
        const match = items.find((s) => s.realpath === state.selectedRealpath)
        state.selectedId = match ? match.id : null
      } else if (state.selectedId && !items.find((s) => s.id === state.selectedId)) {
        state.selectedId = null
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

    if (state.statusFilter === 'enabled') {
      filtered = filtered.filter((skill) => skill.enabled)
    } else if (state.statusFilter === 'disabled') {
      filtered = filtered.filter((skill) => !skill.enabled)
    }

    const sorted = [...filtered]
    if (state.sortKey === 'enabled') {
      sorted.sort((a, b) => Number(b.enabled) - Number(a.enabled) || a.slug.localeCompare(b.slug))
    } else if (state.sortKey === 'mtime') {
      sorted.sort((a, b) => b.skill_mtime - a.skill_mtime || a.slug.localeCompare(b.slug))
    } else {
      sorted.sort((a, b) => a.name.localeCompare(b.name))
    }

    return sorted
  }

  function render() {
    const filtered = getFilteredSkills()
    const enabledCount = state.skills.filter((s) => s.enabled).length

    listMeta.textContent = `${filtered.length} shown · ${enabledCount}/${state.skills.length} enabled`
    countAll.textContent = String(state.skills.length)
    countEnabled.textContent = String(enabledCount)
    countDisabled.textContent = String(state.skills.length - enabledCount)

    filterAll.classList.toggle('active', state.statusFilter === 'all')
    filterEnabled.classList.toggle('active', state.statusFilter === 'enabled')
    filterDisabled.classList.toggle('active', state.statusFilter === 'disabled')
    sortRecent.classList.toggle('active', state.sortKey === 'mtime')

    if (state.groupByStatus) {
      const enabledList = filtered.filter((s) => s.enabled)
      const disabledList = filtered.filter((s) => !s.enabled)
      skillList.innerHTML = `
        ${renderGroup('Enabled', enabledList)}
        ${renderGroup('Disabled', disabledList)}
      `
    } else {
      skillList.innerHTML = filtered.map(renderCard).join('')
    }

    skillList.querySelectorAll<HTMLButtonElement>('.skill-card').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.selectedId = btn.dataset.id || null
        const selected = state.skills.find((s) => s.id === state.selectedId)
        state.selectedRealpath = selected?.realpath ?? null
        renderDetail()
        render()
      })
    })

    renderDetail()
    statusMeta.textContent = state.fingerprint ? `config: ${state.fingerprint.slice(0, 10)}…` : 'config: empty'
  }

  function renderGroup(label: string, list: Skill[]) {
    if (list.length === 0) return ''
    const count = list.length
    return `
      <div class="group-header">
        <span>${label}</span>
        <span class="group-count">${count}</span>
      </div>
      ${list.map(renderCard).join('')}
    `
  }

  function renderCard(skill: Skill) {
    const selected = skill.id === state.selectedId
    const status = skill.enabled ? 'enabled' : 'disabled'
    const name = highlightText(skill.name, state.query)
    const desc = highlightText(skill.description || 'No description', state.query)
    const slug = highlightText(skill.slug, state.query)
    return `
      <button class="skill-card ${selected ? 'selected' : ''} ${!skill.enabled ? 'disabled' : ''}" data-id="${skill.id}">
        <div class="skill-title">${name}</div>
        <div class="skill-desc">${desc}</div>
        <div class="skill-meta">
          <span class="pill ${status}">${status}</span>
          <span class="slug">${slug}</span>
        </div>
      </button>
    `
  }

  function moveSelection(delta: number) {
    const filtered = getFilteredSkills()
    if (filtered.length === 0) return
    const currentIndex = filtered.findIndex((s) => s.id === state.selectedId)
    const nextIndex = currentIndex === -1 ? 0 : Math.min(filtered.length - 1, Math.max(0, currentIndex + delta))
    const next = filtered[nextIndex]
    state.selectedId = next.id
    state.selectedRealpath = next.realpath
    renderDetail()
    render()
  }

  async function toggleSelected() {
    const selected = state.skills.find((s) => s.id === state.selectedId)
    if (!selected) return
    try {
      setStatus(selected.enabled ? 'Disabling…' : 'Enabling…')
      const result = await invoke<string>('set_enabled', {
        skillRealpath: selected.realpath,
        enabled: !selected.enabled
      })
      if (result) {
        restartNotice.hidden = false
      }
      state.selectedRealpath = selected.realpath
      await refreshSkills(false)
      showToast(selected.enabled ? 'Disabled' : 'Enabled')
      setStatus('Ready')
    } catch (err) {
      setError(`Toggle failed: ${formatError(err)}`)
    }
  }

  function renderDetail() {
    const selected = state.skills.find((s) => s.id === state.selectedId) || null
    if (!selected) {
      detailView.hidden = true
      detailView.innerHTML = ''
      detailEmpty.hidden = false
      return
    }

    detailEmpty.hidden = true
    detailView.hidden = false

    const status = selected.enabled ? 'enabled' : 'disabled'
    const toggleLabel = selected.enabled ? 'Disable' : 'Enable'
    const toggleClass = selected.enabled ? 'danger' : 'primary'
    const sourceLabel = selected.enabled ? '默认启用' : '来源：config.toml'
    const restartLabel = restartNotice.hidden ? '' : ' · 重启 Codex 生效'
    detailView.innerHTML = `
      <div class="detail-header">
        <div>
          <div class="detail-title">${escapeHtml(selected.name)}</div>
          <div class="detail-sub">${escapeHtml(selected.slug)}</div>
        </div>
        <div class="pill ${status}">${status}</div>
      </div>
      <div class="detail-status ${status}">
        ${selected.enabled ? 'Enabled' : 'Disabled'} · ${sourceLabel}${restartLabel}
      </div>
      <div class="detail-description">${escapeHtml(selected.description || 'No description found in SKILL.md.')}</div>
      <div class="detail-actions">
        <button class="${toggleClass}" id="toggleBtn">${toggleLabel}</button>
        <button class="danger" id="deleteBtn">Delete</button>
      </div>
      <div class="detail-grid">
        <div class="detail-item">
          <div class="detail-label">
            Real Path
            <button class="icon-btn" data-copy="${escapeHtml(selected.realpath)}" aria-label="Copy real path">Copy</button>
          </div>
          <div class="detail-value">${escapeHtml(selected.realpath)}</div>
        </div>
        <div class="detail-item">
          <div class="detail-label">
            Path
            <button class="icon-btn" data-copy="${escapeHtml(selected.path)}" aria-label="Copy path">Copy</button>
          </div>
          <div class="detail-value">${escapeHtml(selected.path)}</div>
        </div>
        <div class="detail-item">
          <div class="detail-label">
            Skill ID
            <button class="icon-btn" data-copy="${escapeHtml(selected.id)}" aria-label="Copy skill id">Copy</button>
          </div>
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
    const copyButtons = detailView.querySelectorAll<HTMLButtonElement>('[data-copy]')

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
        state.selectedRealpath = selected.realpath
        await refreshSkills(false)
        showToast(selected.enabled ? 'Disabled' : 'Enabled')
        setStatus('Ready')
      } catch (err) {
        setError(`Toggle failed: ${formatError(err)}`)
      }
    })

    deleteBtn.addEventListener('click', async () => {
      const confirmed = await showConfirm(
        `Delete ${selected.name}?`,
        'This will move the folder to Trash.'
      )
      if (!confirmed) return
      try {
        setStatus('Deleting…')
        await invoke('delete_skill', { skillRealpath: selected.realpath })
        state.selectedId = null
        state.selectedRealpath = null
        await refreshSkills(false)
        showToast('Deleted')
        setStatus('Ready')
      } catch (err) {
        setError(`Delete failed: ${formatError(err)}`)
      }
    })

    copyButtons.forEach((btn) => {
      btn.addEventListener('click', async () => {
        const value = btn.dataset.copy || ''
        try {
          await navigator.clipboard.writeText(value)
          btn.dataset.state = 'copied'
          const original = btn.textContent || 'Copy'
          btn.textContent = 'Copied'
          setTimeout(() => {
          btn.textContent = original
          btn.dataset.state = ''
        }, 1200)
          showToast('Copied')
          setStatus('Copied')
        } catch (err) {
          setError(`Copy failed: ${formatError(err)}`)
        }
      })
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
    showToast(text, true)
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

  function escapeRegExp(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }

  function highlightText(value: string, query: string) {
    const safe = escapeHtml(value)
    if (!query) return safe
    const escaped = escapeRegExp(query)
    const regex = new RegExp(escaped, 'ig')
    return safe.replace(regex, (match) => `<mark class="hl">${match}</mark>`)
  }

  function showConfirm(title: string, body: string) {
    return new Promise<boolean>((resolve) => {
      confirmTitle.textContent = title
      confirmBody.textContent = body
      confirmBackdrop.hidden = false

      const cleanup = (result: boolean) => {
        confirmBackdrop.hidden = true
        confirmCancel.removeEventListener('click', onCancel)
        confirmOk.removeEventListener('click', onOk)
        confirmBackdrop.removeEventListener('click', onBackdrop)
        resolve(result)
      }

      const onCancel = () => cleanup(false)
      const onOk = () => cleanup(true)
      const onBackdrop = (event: MouseEvent) => {
        if (event.target === confirmBackdrop) {
          cleanup(false)
        }
      }

      confirmCancel.addEventListener('click', onCancel)
      confirmOk.addEventListener('click', onOk)
      confirmBackdrop.addEventListener('click', onBackdrop)
    })
  }

  function showToast(message: string, isError = false) {
    toast.textContent = message
    toast.dataset.state = isError ? 'error' : 'success'
    toast.hidden = false
    setTimeout(() => {
      toast.hidden = true
    }, 1400)
  }

  void refreshSkills(true)
  void pollFingerprint()
  if (isTauriEnv) {
    setInterval(() => void pollFingerprint(), REFRESH_INTERVAL_MS)
  }
}
