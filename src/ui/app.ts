import { invoke, isTauri } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-dialog'

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
  statusFilter: 'all' | 'enabled' | 'disabled'
  tagFilter: string | null
  language: 'en' | 'zh'
  rootPath: string
}

type RootPathStats = {
  count: number
  lastModified: number | null
}

type RootCandidate = RootPathStats & {
  path: string
  labelKey: string
}

const REFRESH_INTERVAL_MS = 5000
const COMMON_ROOTS: RootCandidate[] = [
  { labelKey: 'rootPathClaude', path: '~/.claude/skills/', count: 0, lastModified: null },
  { labelKey: 'rootPathGemini', path: '~/.gemini/skills/', count: 0, lastModified: null },
  { labelKey: 'rootPathAntigravity', path: '~/.agent/skills/', count: 0, lastModified: null },
  { labelKey: 'rootPathCursor', path: '~/.cursor/skills/', count: 0, lastModified: null },
  { labelKey: 'rootPathCodex', path: '~/.codex/skills/', count: 0, lastModified: null }
]

export function mountApp(root: HTMLElement) {
  root.innerHTML = `
    <div class="app-shell">
      <header class="topbar">
        <div class="brand">
          <div class="brand-mark">CS</div>
          <div>
            <div class="brand-title" id="brandTitle"></div>
            <div class="brand-subtitle" id="brandSubtitle"></div>
          </div>
        </div>
        <div class="topbar-actions">
          <div class="notice" id="restartNotice" hidden></div>
          <button class="ghost" id="refreshBtn"></button>
        </div>
      </header>

      <section class="toolbar">
        <div class="search">
          <span class="search-icon">⌕</span>
          <input id="searchInput" type="search" />
        </div>
        <div class="toolbar-actions">
          <button class="ghost settings-btn" id="settingsBtn">
            <span class="settings-icon" aria-hidden="true">⚙︎</span>
            <span id="settingsBtnLabel"></span>
          </button>
        </div>
      </section>
      <div class="alert-bar" id="alertBar" hidden></div>

      <main class="content">
        <aside class="sidebar">
          <div class="sidebar-title" id="filtersTitle"></div>
          <button class="side-item" data-filter="all" id="filterAll">
            <span id="filterAllLabel"></span>
            <span class="side-count" id="countAll">0</span>
          </button>
          <button class="side-item" data-filter="enabled" id="filterEnabled">
            <span id="filterEnabledLabel"></span>
            <span class="side-count" id="countEnabled">0</span>
          </button>
          <button class="side-item" data-filter="disabled" id="filterDisabled">
            <span id="filterDisabledLabel"></span>
            <span class="side-count" id="countDisabled">0</span>
          </button>
          <div class="sidebar-title" id="sortTitle"></div>
          <button class="side-item" data-sort="name" id="sortName">
            <span id="sortNameLabel"></span>
          </button>
          <button class="side-item" data-sort="enabled" id="sortEnabled">
            <span id="sortEnabledLabel"></span>
          </button>
          <button class="side-item" data-sort="mtime" id="sortRecent">
            <span id="sortRecentLabel"></span>
          </button>
          <div class="sidebar-title" id="tagsTitle"></div>
          <div class="tag-list" id="tagList"></div>
        </aside>
        <aside class="list-panel">
          <div class="list-meta" id="listMeta"></div>
          <div class="skill-list" id="skillList"></div>
        </aside>
        <section class="detail-panel">
          <div id="detailEmpty" class="detail-empty">
            <div class="empty-mark">✦</div>
            <div class="empty-title" id="emptyTitle"></div>
            <div class="empty-subtitle" id="emptySubtitle"></div>
          </div>
          <div id="detailView" class="detail-view" hidden></div>
        </section>
      </main>

      <div class="toast" id="toast" hidden></div>

      <div class="modal-backdrop" id="confirmBackdrop" hidden>
        <div class="modal">
          <div class="modal-title" id="confirmTitle">Delete skill?</div>
          <div class="modal-body" id="confirmBody"></div>
          <div class="modal-actions">
            <button class="ghost" id="confirmCancel"></button>
            <button class="danger" id="confirmOk"></button>
          </div>
        </div>
      </div>

      <div class="modal-backdrop" id="settingsBackdrop" hidden>
        <div class="modal settings-modal">
          <div class="settings-header">
            <div>
              <div class="settings-title" id="settingsTitle"></div>
              <div class="settings-subtitle" id="settingsSubtitle"></div>
            </div>
            <button class="ghost settings-close" id="settingsClose" aria-label="Close">
              <svg class="icon-close" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M6 6l12 12M18 6l-12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
            </button>
          </div>
          <div class="settings-body">
            <div class="settings-card settings-card--split">
              <div>
                <label class="settings-label" id="languageLabel"></label>
                <div class="settings-hint" id="languageHint"></div>
              </div>
              <div class="segmented" id="languageSegmented">
                <button class="segment" data-lang="en">English</button>
                <button class="segment" data-lang="zh">中文</button>
              </div>
            </div>
            <div class="settings-card settings-card--stack">
              <div class="settings-card-head">
                <div>
                  <label class="settings-label" id="rootPathLabel"></label>
                  <div class="settings-hint" id="rootPathHint"></div>
                </div>
              </div>
              <div class="settings-root">
                <div class="settings-input-row">
                  <input id="rootPathInput" type="text" readonly />
                  <button class="ghost settings-browse" id="rootPathBrowse"></button>
                </div>
                <div class="settings-meta" id="rootPathMeta" hidden></div>
                <div class="settings-actions">
                  <button class="ghost settings-detect" id="rootPathDetect"></button>
                </div>
                <div class="settings-quick" id="rootPathQuick"></div>
                <div class="settings-candidates" id="rootPathCandidates" hidden>
                  <div class="settings-candidates-title" id="rootPathCandidatesTitle"></div>
                  <div class="settings-candidates-list" id="rootPathCandidatesList"></div>
                </div>
                <div class="settings-empty" id="rootPathEmpty" hidden>
                  <div class="settings-empty-title" id="rootPathEmptyTitle"></div>
                  <div class="settings-empty-hint" id="rootPathEmptyHint"></div>
                  <div class="settings-empty-actions" id="rootPathEmptyActions"></div>
                </div>
              </div>
            </div>
            <div class="settings-error" id="rootPathError" hidden></div>
          </div>
          <div class="settings-footer">
            <button class="ghost" id="settingsFooterClose"></button>
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
    statusFilter: 'all',
    tagFilter: null,
    language: (localStorage.getItem('csm_language') as AppState['language']) || 'en',
    rootPath: localStorage.getItem('csm_root_path') || ''
  }

  let rootPathStats: RootPathStats | null = null
  let rootPathCandidates: RootCandidate[] = []

  const searchInput = root.querySelector<HTMLInputElement>('#searchInput')!
  const settingsBtn = root.querySelector<HTMLButtonElement>('#settingsBtn')!
  const skillList = root.querySelector<HTMLDivElement>('#skillList')!
  const listMeta = root.querySelector<HTMLDivElement>('#listMeta')!
  const countAll = root.querySelector<HTMLSpanElement>('#countAll')!
  const countEnabled = root.querySelector<HTMLSpanElement>('#countEnabled')!
  const countDisabled = root.querySelector<HTMLSpanElement>('#countDisabled')!
  const tagList = root.querySelector<HTMLDivElement>('#tagList')!
  const filterAll = root.querySelector<HTMLButtonElement>('#filterAll')!
  const filterEnabled = root.querySelector<HTMLButtonElement>('#filterEnabled')!
  const filterDisabled = root.querySelector<HTMLButtonElement>('#filterDisabled')!
  const sortName = root.querySelector<HTMLButtonElement>('#sortName')!
  const sortEnabled = root.querySelector<HTMLButtonElement>('#sortEnabled')!
  const sortRecent = root.querySelector<HTMLButtonElement>('#sortRecent')!
  const detailView = root.querySelector<HTMLDivElement>('#detailView')!
  const detailEmpty = root.querySelector<HTMLDivElement>('#detailEmpty')!
  const statusText = document.createElement('div')
  statusText.id = 'statusText'
  const restartNotice = root.querySelector<HTMLDivElement>('#restartNotice')!
  const refreshBtn = root.querySelector<HTMLButtonElement>('#refreshBtn')!
  const alertBar = root.querySelector<HTMLDivElement>('#alertBar')!
  const toast = root.querySelector<HTMLDivElement>('#toast')!
  const confirmBackdrop = root.querySelector<HTMLDivElement>('#confirmBackdrop')!
  const confirmTitle = root.querySelector<HTMLDivElement>('#confirmTitle')!
  const confirmBody = root.querySelector<HTMLDivElement>('#confirmBody')!
  const confirmCancel = root.querySelector<HTMLButtonElement>('#confirmCancel')!
  const confirmOk = root.querySelector<HTMLButtonElement>('#confirmOk')!
  const settingsBackdrop = root.querySelector<HTMLDivElement>('#settingsBackdrop')!
  const settingsTitle = root.querySelector<HTMLDivElement>('#settingsTitle')!
  const settingsSubtitle = root.querySelector<HTMLDivElement>('#settingsSubtitle')!
  const languageLabel = root.querySelector<HTMLLabelElement>('#languageLabel')!
  const languageHint = root.querySelector<HTMLDivElement>('#languageHint')!
  const settingsClose = root.querySelector<HTMLButtonElement>('#settingsClose')!
  const settingsFooterClose = root.querySelector<HTMLButtonElement>('#settingsFooterClose')!
  const languageSegmented = root.querySelector<HTMLDivElement>('#languageSegmented')!
  const rootPathLabel = root.querySelector<HTMLLabelElement>('#rootPathLabel')!
  const rootPathHint = root.querySelector<HTMLDivElement>('#rootPathHint')!
  const rootPathInput = root.querySelector<HTMLInputElement>('#rootPathInput')!
  const rootPathBrowse = root.querySelector<HTMLButtonElement>('#rootPathBrowse')!
  const rootPathMeta = root.querySelector<HTMLDivElement>('#rootPathMeta')!
  const rootPathDetect = root.querySelector<HTMLButtonElement>('#rootPathDetect')!
  const rootPathQuick = root.querySelector<HTMLDivElement>('#rootPathQuick')!
  const rootPathCandidatesEl = root.querySelector<HTMLDivElement>('#rootPathCandidates')!
  const rootPathCandidatesTitle = root.querySelector<HTMLDivElement>('#rootPathCandidatesTitle')!
  const rootPathCandidatesList = root.querySelector<HTMLDivElement>('#rootPathCandidatesList')!
  const rootPathEmpty = root.querySelector<HTMLDivElement>('#rootPathEmpty')!
  const rootPathEmptyTitle = root.querySelector<HTMLDivElement>('#rootPathEmptyTitle')!
  const rootPathEmptyHint = root.querySelector<HTMLDivElement>('#rootPathEmptyHint')!
  const rootPathEmptyActions = root.querySelector<HTMLDivElement>('#rootPathEmptyActions')!
  const rootPathError = root.querySelector<HTMLDivElement>('#rootPathError')!
  const brandTitle = root.querySelector<HTMLDivElement>('#brandTitle')!
  const brandSubtitle = root.querySelector<HTMLDivElement>('#brandSubtitle')!
  const filtersTitle = root.querySelector<HTMLDivElement>('#filtersTitle')!
  const tagsTitle = root.querySelector<HTMLDivElement>('#tagsTitle')!
  const sortTitle = root.querySelector<HTMLDivElement>('#sortTitle')!
  const filterAllLabel = root.querySelector<HTMLSpanElement>('#filterAllLabel')!
  const filterEnabledLabel = root.querySelector<HTMLSpanElement>('#filterEnabledLabel')!
  const filterDisabledLabel = root.querySelector<HTMLSpanElement>('#filterDisabledLabel')!
  const sortNameLabel = root.querySelector<HTMLSpanElement>('#sortNameLabel')!
  const sortEnabledLabel = root.querySelector<HTMLSpanElement>('#sortEnabledLabel')!
  const sortRecentLabel = root.querySelector<HTMLSpanElement>('#sortRecentLabel')!
  const emptyTitle = root.querySelector<HTMLDivElement>('#emptyTitle')!
  const emptySubtitle = root.querySelector<HTMLDivElement>('#emptySubtitle')!
  const isTauriEnv = isTauri()

  searchInput.addEventListener('input', () => {
    state.query = searchInput.value.trim().toLowerCase()
    render()
  })

  ;[filterAll, filterEnabled, filterDisabled].forEach((btn) => {
    btn.addEventListener('click', () => {
      state.statusFilter = (btn.dataset.filter as AppState['statusFilter']) || 'all'
      state.tagFilter = null
      render()
    })
  })

  ;[
    [sortName, 'name'],
    [sortEnabled, 'enabled'],
    [sortRecent, 'mtime']
  ].forEach(([btn, key]) => {
    ;(btn as HTMLButtonElement).addEventListener('click', () => {
      state.sortKey = key as SortKey
      render()
    })
  })

  refreshBtn.addEventListener('click', () => {
    void refreshSkills(true)
  })

  settingsBtn.addEventListener('click', () => {
    openSettings(false)
  })

  settingsBackdrop.addEventListener('click', (event) => {
    if (event.target === settingsBackdrop) {
      void closeSettings()
    }
  })

  settingsClose.addEventListener('click', () => {
    void closeSettings()
  })

  settingsFooterClose.addEventListener('click', () => {
    void closeSettings()
  })

  rootPathInput.addEventListener('click', () => {
    void browseForRootPath()
  })

  rootPathBrowse.addEventListener('click', () => {
    void browseForRootPath()
  })

  rootPathDetect.addEventListener('click', () => {
    void autoDetectFirst()
  })

  languageSegmented.querySelectorAll<HTMLButtonElement>('.segment').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.language = (btn.dataset.lang as AppState['language']) || 'en'
      localStorage.setItem('csm_language', state.language)
      applyLanguage()
      render()
    })
  })

  function formatStatsLine(stats: RootPathStats | null, path: string) {
    if (!stats) return ''
    const updated = stats.lastModified ? formatDate(stats.lastModified) : '—'
    return t('rootPathDetected', { count: stats.count, path, updated })
  }

  function updateRootPathMeta(path: string, stats: RootPathStats | null) {
    if (!path || !stats) {
      rootPathMeta.hidden = true
      rootPathMeta.textContent = ''
      return
    }
    rootPathMeta.textContent = formatStatsLine(stats, path)
    rootPathMeta.hidden = false
  }

  async function getStatsForPath(path: string): Promise<RootPathStats | null> {
    if (!isTauriEnv) return null
    try {
      const items = await invoke<Skill[]>('list_skills', { rootPath: path })
      if (!items.length) return null
      const lastModified = items.reduce((max, skill) => Math.max(max, skill.skill_mtime || 0), 0)
      return { count: items.length, lastModified: lastModified || null }
    } catch {
      return null
    }
  }

  function renderQuickButtons(container: HTMLElement, includeAll = true) {
    container.innerHTML = ''
    const roots = includeAll ? COMMON_ROOTS : COMMON_ROOTS.filter((item) =>
      ['rootPathClaude', 'rootPathCursor', 'rootPathCodex'].includes(item.labelKey)
    )
    roots.forEach((item) => {
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = 'ghost settings-quick-btn'
      btn.textContent = t(item.labelKey)
      btn.dataset.path = item.path
      btn.addEventListener('click', () => void applyRootPath(item.path, 'quick'))
      container.appendChild(btn)
    })
  }

  function renderCandidates() {
    rootPathCandidatesList.innerHTML = ''
    if (!rootPathCandidates.length) {
      rootPathCandidatesEl.hidden = true
      return
    }
    rootPathCandidatesEl.hidden = false
    rootPathCandidatesTitle.textContent = t('rootPathCandidatesTitle')
    rootPathCandidates.forEach((candidate) => {
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = 'settings-candidate'
      btn.dataset.path = candidate.path
      btn.innerHTML = `
        <div class="settings-candidate-body">
          <div class="settings-candidate-path">${candidate.path}</div>
          <div class="settings-candidate-meta">${t('rootPathCandidateMeta', {
            count: candidate.count,
            updated: candidate.lastModified ? formatDate(candidate.lastModified) : '—'
          })}</div>
        </div>
        <span class="settings-candidate-action">${t('select')}</span>
      `
      btn.addEventListener('click', () => void applyRootPath(candidate.path, 'candidate'))
      rootPathCandidatesList.appendChild(btn)
    })
  }

  function setEmptyState(show: boolean) {
    rootPathEmpty.hidden = !show
    if (show) {
      rootPathEmptyTitle.textContent = t('rootPathEmptyTitle')
      rootPathEmptyHint.textContent = t('rootPathEmptyHint')
      renderQuickButtons(rootPathEmptyActions, false)
    }
  }

  async function detectRootCandidates() {
    rootPathCandidates = []
    rootPathCandidatesTitle.textContent = ''
    rootPathCandidatesList.innerHTML = ''
    rootPathCandidatesEl.hidden = true
    setEmptyState(false)
    for (const root of COMMON_ROOTS) {
      const stats = await getStatsForPath(root.path)
      if (stats && stats.count > 0) {
        rootPathCandidates.push({ ...root, ...stats })
      }
    }
    renderCandidates()
    if (!rootPathCandidates.length) {
      setEmptyState(true)
    }
  }

  async function applyRootPath(path: string, source: 'browse' | 'quick' | 'candidate' | 'detect') {
    rootPathInput.value = path
    rootPathError.hidden = true
    rootPathMeta.textContent = t('rootPathChecking')
    rootPathMeta.hidden = false
    setEmptyState(false)
    const stats = await getStatsForPath(path)
    if (!stats) {
      rootPathStats = null
      rootPathMeta.hidden = true
      rootPathError.textContent = t('rootPathNoSkills')
      rootPathError.hidden = false
      updateSettingsLock()
      return
    }
    rootPathStats = stats
    updateRootPathMeta(path, stats)
    updateSettingsLock()
    if (source === 'detect') {
      showToast(t('rootPathDetectedToast', { count: stats.count, path }))
    }
  }

  async function browseForRootPath() {
    try {
      const result = await open({ directory: true, multiple: false })
      if (!result) return
      const path = Array.isArray(result) ? result[0] : result
      if (!path) return
      await applyRootPath(path, 'browse')
    } catch (err) {
      setError(`${t('rootPathBrowseFailed')}: ${formatError(err)}`)
    }
  }

  async function autoDetectFirst() {
    rootPathError.hidden = true
    await detectRootCandidates()
    if (rootPathCandidates.length) {
      await applyRootPath(rootPathCandidates[0].path, 'detect')
      return
    }
    rootPathError.textContent = t('rootPathDetectNone')
    rootPathError.hidden = false
    setEmptyState(true)
  }

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
      if (!state.rootPath) {
        setError(t('rootRequired'))
        return
      }
      if (showStatus) setStatus('Refreshing…')
      const items = await invoke<Skill[]>('list_skills', { rootPath: state.rootPath })
      state.skills = items
      const lastModified = items.reduce((max, skill) => Math.max(max, skill.skill_mtime || 0), 0)
      rootPathStats = items.length ? { count: items.length, lastModified: lastModified || null } : null
      updateRootPathMeta(state.rootPath, rootPathStats)
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

    if (state.tagFilter) {
      filtered = filtered.filter((skill) => getTags(skill).includes(state.tagFilter!))
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

    listMeta.textContent = t('listMeta', {
      shown: filtered.length,
      enabled: enabledCount,
      total: state.skills.length
    })
    countAll.textContent = String(state.skills.length)
    countEnabled.textContent = String(enabledCount)
    countDisabled.textContent = String(state.skills.length - enabledCount)

    filterAll.classList.toggle('active', state.statusFilter === 'all')
    filterEnabled.classList.toggle('active', state.statusFilter === 'enabled')
    filterDisabled.classList.toggle('active', state.statusFilter === 'disabled')
    sortName.classList.toggle('active', state.sortKey === 'name')
    sortEnabled.classList.toggle('active', state.sortKey === 'enabled')
    sortRecent.classList.toggle('active', state.sortKey === 'mtime')

    renderTags()

    skillList.innerHTML = filtered.map(renderCard).join('')

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
  }

  function renderTags() {
    const counts = new Map<string, number>()
    state.skills.forEach((skill) => {
      getTags(skill).forEach((tag) => {
        counts.set(tag, (counts.get(tag) || 0) + 1)
      })
    })

    const tags = Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 12)

    const total = state.skills.length
    tagList.innerHTML = `
      <button class="tag-item ${state.tagFilter === null ? 'active' : ''}" data-tag="">
        <span class="tag-label">All</span>
        <span class="tag-count">${total}</span>
      </button>
      ${tags
        .map(
          ([tag, count]) => `
            <button class="tag-item ${state.tagFilter === tag ? 'active' : ''}" data-tag="${escapeHtml(tag)}">
              <span class="tag-label">${escapeHtml(tagLabel(tag))}</span>
              <span class="tag-count">${count}</span>
            </button>
          `
        )
        .join('')}
    `

    tagList.querySelectorAll<HTMLButtonElement>('.tag-item').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tag = btn.dataset.tag || null
        state.tagFilter = tag ? (state.tagFilter === tag ? null : tag) : null
        render()
      })
    })
  }

  function renderCard(skill: Skill) {
    const selected = skill.id === state.selectedId
    const status = skill.enabled ? 'enabled' : 'disabled'
    const name = highlightText(skill.name, state.query)
    const desc = highlightText(normalizeDescription(skill.description || t('noDescription')), state.query)
    const mtime = formatShortDate(skill.skill_mtime)
    const allTags = getTags(skill)
    const tags = allTags.slice(0, 2)
    const extraCount = Math.max(0, allTags.length - tags.length)
    return `
      <button class="skill-card ${selected ? 'selected' : ''} ${!skill.enabled ? 'disabled' : ''}" data-id="${skill.id}">
        <div class="skill-head">
          <div class="skill-title">${name}</div>
          <span class="pill ${status}">${t(status)}</span>
        </div>
        <div class="skill-desc">${desc}</div>
        <div class="skill-meta">
          <div class="tag-row">
            ${tags.map((tag) => `<span class="tag">${escapeHtml(tagLabel(tag))}</span>`).join('')}
            ${extraCount > 0 ? `<span class="tag tag-more">+${extraCount}</span>` : ''}
          </div>
          <span class="mtime">${mtime}</span>
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
    const toggleLabel = selected.enabled ? t('disable') : t('enable')
    const toggleClass = selected.enabled ? 'danger' : 'primary'
    const sourceLabel = selected.enabled ? t('defaultEnabled') : t('fromConfig')
    detailView.innerHTML = `
      <div class="detail-header">
        <div>
          <div class="detail-title">${escapeHtml(selected.name)}</div>
          <div class="detail-tags">
            ${getTags(selected)
              .slice(0, 4)
              .map((tag) => `<span class="tag">${escapeHtml(tagLabel(tag))}</span>`)
              .join('')}
          </div>
        </div>
        <div class="pill ${status}">${t(status)}</div>
      </div>
      <div class="detail-status ${status}">
        ${selected.enabled ? t('enabled') : t('disabled')} · ${sourceLabel}
      </div>
      <div class="detail-description">${escapeHtml(
        normalizeDescription(selected.description || t('noDescriptionDetail'))
      )}</div>
      <div class="detail-actions">
        <div class="action-row">
          <button class="${toggleClass} primary-action" id="toggleBtn">${toggleLabel}</button>
        </div>
        <div class="action-divider"></div>
        <div class="action-row">
          <button class="danger ghost-danger" id="deleteBtn">${t('delete')}</button>
        </div>
      </div>
      <div class="detail-grid">
        <div class="detail-item full">
          <div class="detail-label">
            <span>${t('realPath')}</span>
            <div class="detail-actions-inline">
              <button class="icon-btn" data-copy="${escapeHtml(selected.realpath)}" aria-label="${t('copy')}">${t('copy')}</button>
              <button class="icon-btn" id="openPathBtn" aria-label="${t('open')}">${t('open')}</button>
            </div>
          </div>
          <div class="detail-value">${escapeHtml(selected.realpath)}</div>
        </div>
        <div class="detail-item full">
          <div class="detail-label">${t('lastModified')}</div>
          <div class="detail-value">${formatDate(selected.skill_mtime)}</div>
        </div>
      </div>
      <div class="detail-meta-note">${t('pathsNote')}</div>
    `

    const toggleBtn = detailView.querySelector<HTMLButtonElement>('#toggleBtn')!
    const deleteBtn = detailView.querySelector<HTMLButtonElement>('#deleteBtn')!
    const openPathBtn = detailView.querySelector<HTMLButtonElement>('#openPathBtn')!
    const copyButtons = detailView.querySelectorAll<HTMLButtonElement>('[data-copy]')

    toggleBtn.addEventListener('click', async () => {
      try {
        setStatus(selected.enabled ? t('disabling') : t('enabling'))
        const result = await invoke<string>('set_enabled', {
          skillRealpath: selected.realpath,
          enabled: !selected.enabled
        })
        if (result) {
          restartNotice.hidden = false
        }
        state.selectedRealpath = selected.realpath
        await refreshSkills(false)
        showToast(selected.enabled ? t('disabled') : t('enabled'))
        setStatus(t('ready'))
      } catch (err) {
        setError(`${t('toggleFailed')}: ${formatError(err)}`)
      }
    })

    deleteBtn.addEventListener('click', async () => {
      const confirmed = await showConfirm(
        t('deleteConfirmTitle', { name: selected.name }),
        t('deleteConfirmBody')
      )
      if (!confirmed) return
      try {
        setStatus(t('deleting'))
        await invoke('delete_skill', { skillRealpath: selected.realpath, rootPath: state.rootPath })
        state.selectedId = null
        state.selectedRealpath = null
        await refreshSkills(false)
        showToast(t('deleted'))
        setStatus(t('ready'))
      } catch (err) {
        setError(`${t('deleteFailed')}: ${formatError(err)}`)
      }
    })

    openPathBtn.addEventListener('click', async () => {
      try {
        setStatus(t('opening'))
        await invoke('open_skill_location', { skillRealpath: selected.realpath })
        setStatus(t('ready'))
      } catch (err) {
        setError(`${t('openFailed')}: ${formatError(err)}`)
      }
    })

    copyButtons.forEach((btn) => {
      btn.addEventListener('click', async () => {
        const value = btn.dataset.copy || ''
        try {
          await navigator.clipboard.writeText(value)
          btn.dataset.state = 'copied'
          const original = btn.textContent || t('copy')
          btn.textContent = t('copied')
          setTimeout(() => {
            btn.textContent = original
            btn.dataset.state = ''
          }, 1200)
          showToast(t('copied'))
          setStatus(t('copied'))
        } catch (err) {
          setError(`${t('copyFailed')}: ${formatError(err)}`)
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

  function formatShortDate(epochSeconds: number) {
    if (!epochSeconds) return '—'
    const date = new Date(epochSeconds * 1000)
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
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

  function normalizeDescription(value: string) {
    const cleaned = value
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/^>\s?/gm, '')
      .replace(/^[\s-]*[-*+]\s+/gm, '')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')

    const dropLabels = new Set([
      'purpose',
      'overview',
      'when to use',
      'use when',
      'description',
      'what it does'
    ])

    const baseLines = cleaned
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
    const lines = baseLines.filter((line) => !dropLabels.has(line.toLowerCase()))

    const joined = (lines.length > 0 ? lines : baseLines).join(' ')
    return joined
      .replace(/^(purpose|overview|when to use|use when|description|what it does)\s*[:\-–—]\s*/i, '')
      .replace(/\s+/g, ' ')
      .trim()
  }

  function getTags(skill: Skill) {
    const hay = `${skill.slug} ${skill.name} ${skill.description}`.toLowerCase()
    const tags: string[] = []
    const add = (key: string) => {
      if (!tags.includes(key)) tags.push(key)
    }

    if (/(security|pentest|vuln|attack|exploit|xss|sql|idor|auth|privilege)/.test(hay)) add('security')
    if (/(frontend|ui|ux|design|css|react|web|tailwind)/.test(hay)) add('frontend')
    if (/(backend|api|server|node|database|prisma|graphql)/.test(hay)) add('backend')
    if (/(cloud|aws|gcp|azure|devops|docker|k8s|infra)/.test(hay)) add('infra')
    if (/(ml|ai|agent|llm|prompt|rag|nlp)/.test(hay)) add('ai')
    if (/(testing|test|qa|debug)/.test(hay)) add('testing')
    if (/(mobile|ios|android|swift|react native)/.test(hay)) add('mobile')
    if (/(game|unity|unreal|3d|2d|webgl)/.test(hay)) add('game')
    if (/(marketing|seo|growth|copy|ads|content)/.test(hay)) add('marketing')
    if (tags.length === 0) tags.push('general')
    return tags
  }

  function tagLabel(key: string) {
    const dict = translations[state.language] || translations.en
    const tagMap = dict.tagLabels || {}
    return tagMap[key] || key
  }

  function showConfirm(title: string, body: string) {
    return new Promise<boolean>((resolve) => {
      confirmTitle.textContent = title
      confirmBody.textContent = body
      confirmCancel.textContent = t('cancel')
      confirmOk.textContent = t('delete')
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

  function t(key: string, vars: Record<string, string | number> = {}) {
    const dict = translations[state.language] || translations.en
    const template = dict[key] || key
    return Object.entries(vars).reduce((acc, [k, v]) => acc.replace(`{${k}}`, String(v)), template)
  }

  function applyLanguage() {
    brandTitle.textContent = t('appTitle')
    brandSubtitle.textContent = t('appSubtitle')
    refreshBtn.textContent = t('refresh')
    restartNotice.textContent = t('restartNotice')
    searchInput.placeholder = t('searchPlaceholder')
    settingsBtnLabel.textContent = t('settings')
    settingsBtnLabel.textContent = t('settings')
    filtersTitle.textContent = t('filters')
    tagsTitle.textContent = t('tags')
    sortTitle.textContent = t('sort')
    filterAllLabel.textContent = t('allSkills')
    filterEnabledLabel.textContent = t('enabled')
    filterDisabledLabel.textContent = t('disabled')
    sortNameLabel.textContent = t('sortName')
    sortEnabledLabel.textContent = t('sortEnabled')
    sortRecentLabel.textContent = t('sortRecent')
    emptyTitle.textContent = t('emptyTitle')
    emptySubtitle.textContent = t('emptySubtitle')
    settingsTitle.textContent = t('settingsTitle')
    settingsSubtitle.textContent = t('settingsSubtitle')
    languageLabel.textContent = t('language')
    languageHint.textContent = t('languageHint')
    rootPathLabel.textContent = t('rootPath')
    rootPathHint.textContent = t('rootPathHint')
    rootPathBrowse.textContent = t('rootPathBrowse')
    rootPathDetect.textContent = t('rootPathDetect')
    rootPathCandidatesTitle.textContent = t('rootPathCandidatesTitle')
    settingsClose.setAttribute('aria-label', t('close'))
    settingsFooterClose.textContent = t('done')
    languageSegmented.querySelectorAll<HTMLButtonElement>('.segment').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.lang === state.language)
    })
    rootPathInput.placeholder = t('rootPathPlaceholder')
    rootPathInput.value = state.rootPath
    renderQuickButtons(rootPathQuick)
    renderCandidates()
    if (!rootPathEmpty.hidden) {
      setEmptyState(true)
    }
    updateRootPathMeta(state.rootPath, rootPathStats)
    updateSettingsLock()
    if (!statusText.textContent) {
      setStatus(t('ready'))
    }
  }

  function updateSettingsLock() {
    const locked = !rootPathInput.value.trim()
    settingsClose.disabled = locked
    settingsFooterClose.disabled = locked
    settingsBackdrop.dataset.locked = locked ? 'true' : 'false'
  }

  function openSettings(force: boolean) {
    settingsBackdrop.hidden = false
    rootPathInput.value = state.rootPath
    rootPathError.hidden = true
    renderQuickButtons(rootPathQuick)
    updateRootPathMeta(state.rootPath, rootPathStats)
    if (!state.rootPath) {
      void detectRootCandidates()
    }
    if (force) {
      settingsBackdrop.dataset.locked = 'true'
      settingsClose.disabled = true
      settingsFooterClose.disabled = true
    } else {
      updateSettingsLock()
    }
  }

  async function closeSettings() {
    const candidate = rootPathInput.value.trim()
    if (!candidate) {
      rootPathError.textContent = t('rootPathRequired')
      rootPathError.hidden = false
      return
    }
    let stats = rootPathStats
    if (!stats || candidate !== state.rootPath) {
      stats = await getStatsForPath(candidate)
    }
    if (!stats) {
      rootPathError.textContent = t('rootPathNoSkills')
      rootPathError.hidden = false
      return
    }
    rootPathStats = stats
    state.rootPath = candidate
    localStorage.setItem('csm_root_path', state.rootPath)
    rootPathError.hidden = true
    settingsBackdrop.hidden = true
    updateSettingsLock()
    await refreshSkills(true)
  }

  const translations: Record<string, Record<string, string>> = {
    en: {
      appTitle: 'Skills Manager',
      appSubtitle: 'Local skill registry • Tauri desktop',
      refresh: 'Refresh',
      restartNotice: 'Restart app to apply',
      searchPlaceholder: 'Search skills by name or description',
      settings: 'Settings',
      filters: 'Filters',
      tags: 'Tags',
      sort: 'Sort',
      allSkills: 'All skills',
      enabled: 'Enabled',
      disabled: 'Disabled',
      sortName: 'Name (A–Z)',
      sortEnabled: 'Enabled first',
      sortRecent: 'Recent changes',
      listMeta: '{shown} shown · {enabled}/{total} enabled',
      emptyTitle: 'Select a skill',
      emptySubtitle: 'Inspect metadata, toggle enablement, or delete safely.',
      enable: 'Enable',
      disable: 'Disable',
      copy: 'Copy',
      defaultEnabled: 'Default enabled',
      fromConfig: 'From config.toml',
      noDescription: 'No description',
      noDescriptionDetail: 'No description found in SKILL.md.',
      realPath: 'Real Path',
      path: 'Path',
      skillId: 'Skill ID',
      lastModified: 'Last Modified',
      pathsNote: 'Paths are shown for transparency and troubleshooting.',
      delete: 'Delete',
      cancel: 'Cancel',
      close: 'Close',
      settingsTitle: 'Settings',
      settingsSubtitle: 'Personalization',
      language: 'Language',
      languageHint: 'Choose your preferred UI language.',
      rootPath: 'Skills root path',
      rootPathHint: 'Set the folder that contains your SKILL.md directories.',
      rootPathPlaceholder: '/path/to/skills',
      rootPathBrowse: 'Browse',
      rootPathDetect: 'Auto Detect',
      rootPathChecking: 'Checking…',
      rootPathDetected: 'Selected {path} · {count} skills · Last updated {updated}',
      rootPathDetectedToast: 'Detected {count} skills at {path}',
      rootPathNoSkills: 'No skills found in that folder.',
      rootPathDetectNone: 'No known skills folders detected.',
      rootPathCandidatesTitle: 'Detected paths',
      rootPathCandidateMeta: '{count} skills · Updated {updated}',
      rootPathEmptyTitle: 'Choose a folder',
      rootPathEmptyHint: 'Pick a known location or auto-detect.',
      rootPathRequired: 'Please set a valid skills root path.',
      rootPathBrowseFailed: 'Browse failed',
      rootRequired: 'Skills root path is required. Open Settings to configure.',
      done: 'Done',
      select: 'Select',
      deleteConfirmTitle: 'Delete {name}?',
      deleteConfirmBody: 'This will move the folder to Trash.',
      enabling: 'Enabling…',
      disabling: 'Disabling…',
      deleting: 'Deleting…',
      deleted: 'Deleted',
      copied: 'Copied',
      ready: 'Ready',
      toggleFailed: 'Toggle failed',
      deleteFailed: 'Delete failed',
      copyFailed: 'Copy failed',
      open: 'Open',
      opening: 'Opening…',
      openFailed: 'Open failed',
      rootPathClaude: 'Claude Code',
      rootPathGemini: 'Gemini CLI',
      rootPathAntigravity: 'Antigravity IDE',
      rootPathCursor: 'Cursor',
      rootPathCodex: 'Codex',
      tagLabels: {
        security: 'Security',
        frontend: 'Frontend',
        backend: 'Backend',
        infra: 'Infra',
        ai: 'AI',
        testing: 'Testing',
        mobile: 'Mobile',
        game: 'Game',
        marketing: 'Marketing',
        general: 'General'
      }
    },
    zh: {
      appTitle: '技能管理器',
      appSubtitle: '本地技能注册表 • Tauri 桌面端',
      refresh: '刷新',
      restartNotice: '重启应用生效',
      searchPlaceholder: '按名称或描述搜索',
      settings: '设置',
      filters: '过滤',
      tags: '标签',
      sort: '排序',
      allSkills: '全部技能',
      enabled: '启用',
      disabled: '禁用',
      sortName: '名称 (A–Z)',
      sortEnabled: '启用优先',
      sortRecent: '最近修改',
      listMeta: '显示 {shown} · 启用 {enabled}/{total}',
      emptyTitle: '选择一个技能',
      emptySubtitle: '查看元信息、切换启用状态或安全删除。',
      enable: '启用',
      disable: '禁用',
      copy: '复制',
      defaultEnabled: '默认启用',
      fromConfig: '来源：config.toml',
      noDescription: '暂无描述',
      noDescriptionDetail: 'SKILL.md 中未提供描述。',
      realPath: '真实路径',
      path: '路径',
      skillId: '技能 ID',
      lastModified: '最近修改',
      pathsNote: '路径用于透明与排错。',
      delete: '删除',
      cancel: '取消',
      close: '关闭',
      settingsTitle: '设置',
      settingsSubtitle: '个性化',
      language: '语言',
      languageHint: '选择你偏好的界面语言。',
      rootPath: '技能根目录',
      rootPathHint: '设置包含 SKILL.md 的目录。',
      rootPathPlaceholder: '/path/to/skills',
      rootPathBrowse: '浏览',
      rootPathDetect: '自动检测',
      rootPathChecking: '正在检测…',
      rootPathDetected: '已选择 {path} · {count} 个 skills · 最近更新 {updated}',
      rootPathDetectedToast: '已检测到 {count} 个 skills：{path}',
      rootPathNoSkills: '该文件夹未发现 skills。',
      rootPathDetectNone: '未检测到常见 skills 路径。',
      rootPathCandidatesTitle: '检测到的路径',
      rootPathCandidateMeta: '{count} 个 skills · 更新 {updated}',
      rootPathEmptyTitle: '选择文件夹',
      rootPathEmptyHint: '选择常见路径或自动检测。',
      rootPathRequired: '请设置有效的技能根目录。',
      rootPathBrowseFailed: '浏览失败',
      rootRequired: '需要先设置技能根目录，请在设置中配置。',
      done: '完成',
      select: '选择',
      deleteConfirmTitle: '删除 {name}？',
      deleteConfirmBody: '将把文件夹移到废纸篓。',
      enabling: '正在启用…',
      disabling: '正在禁用…',
      deleting: '正在删除…',
      deleted: '已删除',
      copied: '已复制',
      ready: '就绪',
      toggleFailed: '切换失败',
      deleteFailed: '删除失败',
      copyFailed: '复制失败',
      open: '打开',
      opening: '正在打开…',
      openFailed: '打开失败',
      rootPathClaude: 'Claude Code',
      rootPathGemini: 'Gemini CLI',
      rootPathAntigravity: 'Antigravity IDE',
      rootPathCursor: 'Cursor',
      rootPathCodex: 'Codex',
      tagLabels: {
        security: '安全',
        frontend: '前端',
        backend: '后端',
        infra: '基础设施',
        ai: 'AI',
        testing: '测试',
        mobile: '移动端',
        game: '游戏',
        marketing: '营销',
        general: '通用'
      }
    }
  }
  applyLanguage()
  if (!state.rootPath) {
    openSettings(true)
  } else {
    void refreshSkills(true)
  }
  void pollFingerprint()
  if (isTauriEnv) {
    setInterval(() => void pollFingerprint(), REFRESH_INTERVAL_MS)
  }
}
