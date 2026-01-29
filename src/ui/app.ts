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
  statusFilter: 'all' | 'enabled' | 'disabled'
  tagFilter: string | null
  language: 'en' | 'zh'
}

const REFRESH_INTERVAL_MS = 5000

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

      <footer class="statusbar">
        <div id="statusText"></div>
        <div class="status-meta" id="statusMeta"></div>
      </footer>

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
              <span aria-hidden="true">✕</span>
            </button>
          </div>
          <div class="settings-body">
            <div class="settings-card">
              <div>
                <label class="settings-label" id="languageLabel"></label>
                <div class="settings-hint" id="languageHint"></div>
              </div>
              <div class="segmented" id="languageSegmented">
                <button class="segment" data-lang="en">English</button>
                <button class="segment" data-lang="zh">中文</button>
              </div>
            </div>
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
    language: (localStorage.getItem('csm_language') as AppState['language']) || 'en'
  }

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
  const settingsBackdrop = root.querySelector<HTMLDivElement>('#settingsBackdrop')!
  const settingsTitle = root.querySelector<HTMLDivElement>('#settingsTitle')!
  const settingsSubtitle = root.querySelector<HTMLDivElement>('#settingsSubtitle')!
  const languageLabel = root.querySelector<HTMLLabelElement>('#languageLabel')!
  const languageHint = root.querySelector<HTMLDivElement>('#languageHint')!
  const settingsClose = root.querySelector<HTMLButtonElement>('#settingsClose')!
  const settingsFooterClose = root.querySelector<HTMLButtonElement>('#settingsFooterClose')!
  const languageSegmented = root.querySelector<HTMLDivElement>('#languageSegmented')!
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
    settingsBackdrop.hidden = false
  })

  settingsBackdrop.addEventListener('click', (event) => {
    if (event.target === settingsBackdrop) {
      settingsBackdrop.hidden = true
    }
  })

  settingsClose.addEventListener('click', () => {
    settingsBackdrop.hidden = true
  })

  settingsFooterClose.addEventListener('click', () => {
    settingsBackdrop.hidden = true
  })

  languageSegmented.querySelectorAll<HTMLButtonElement>('.segment').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.language = (btn.dataset.lang as AppState['language']) || 'en'
      localStorage.setItem('csm_language', state.language)
      applyLanguage()
      render()
    })
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
    statusMeta.textContent = state.fingerprint ? `config: ${state.fingerprint.slice(0, 10)}…` : 'config: empty'
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
              <span class="tag-label">${escapeHtml(tag)}</span>
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
    const desc = highlightText(normalizeDescription(skill.description || 'No description'), state.query)
    const mtime = formatShortDate(skill.skill_mtime)
    const tags = getTags(skill).slice(0, 2)
    return `
      <button class="skill-card ${selected ? 'selected' : ''} ${!skill.enabled ? 'disabled' : ''}" data-id="${skill.id}">
        <div class="skill-head">
          <div class="skill-title">${name}</div>
          <span class="pill ${status}">${t(status)}</span>
        </div>
        <div class="skill-desc">${desc}</div>
        <div class="skill-meta">
          <div class="tag-row">
            ${tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}
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
              .map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`)
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
        <div class="detail-item">
          <div class="detail-label">
            ${t('realPath')}
            <button class="icon-btn" data-copy="${escapeHtml(selected.realpath)}" aria-label="${t('copy')}">${t('copy')}</button>
          </div>
          <div class="detail-value">${escapeHtml(selected.realpath)}</div>
        </div>
        <div class="detail-item">
          <div class="detail-label">
            ${t('path')}
            <button class="icon-btn" data-copy="${escapeHtml(selected.path)}" aria-label="${t('copy')}">${t('copy')}</button>
          </div>
          <div class="detail-value">${escapeHtml(selected.path)}</div>
        </div>
        <div class="detail-item">
          <div class="detail-label">
            ${t('skillId')}
            <button class="icon-btn" data-copy="${escapeHtml(selected.id)}" aria-label="${t('copy')}">${t('copy')}</button>
          </div>
          <div class="detail-value mono">${escapeHtml(selected.id)}</div>
        </div>
        <div class="detail-item">
          <div class="detail-label">${t('lastModified')}</div>
          <div class="detail-value">${formatDate(selected.skill_mtime)}</div>
        </div>
      </div>
      <div class="detail-meta-note">${t('pathsNote')}</div>
    `

    const toggleBtn = detailView.querySelector<HTMLButtonElement>('#toggleBtn')!
    const deleteBtn = detailView.querySelector<HTMLButtonElement>('#deleteBtn')!
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
        await invoke('delete_skill', { skillRealpath: selected.realpath })
        state.selectedId = null
        state.selectedRealpath = null
        await refreshSkills(false)
        showToast(t('deleted'))
        setStatus(t('ready'))
      } catch (err) {
        setError(`${t('deleteFailed')}: ${formatError(err)}`)
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
    const add = (label: string) => {
      if (!tags.includes(label)) tags.push(label)
    }

    if (/(security|pentest|vuln|attack|exploit|xss|sql|idor|auth|privilege)/.test(hay)) add('Security')
    if (/(frontend|ui|ux|design|css|react|web|tailwind)/.test(hay)) add('Frontend')
    if (/(backend|api|server|node|database|prisma|graphql)/.test(hay)) add('Backend')
    if (/(cloud|aws|gcp|azure|devops|docker|k8s|infra)/.test(hay)) add('Infra')
    if (/(ml|ai|agent|llm|prompt|rag|nlp)/.test(hay)) add('AI')
    if (/(testing|test|qa|debug)/.test(hay)) add('Testing')
    if (/(mobile|ios|android|swift|react native)/.test(hay)) add('Mobile')
    if (/(game|unity|unreal|3d|2d|webgl)/.test(hay)) add('Game')
    if (/(marketing|seo|growth|copy|ads|content)/.test(hay)) add('Marketing')
    if (tags.length === 0) tags.push('General')
    return tags
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
    settingsClose.setAttribute('aria-label', t('close'))
    settingsFooterClose.textContent = t('done')
    languageSegmented.querySelectorAll<HTMLButtonElement>('.segment').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.lang === state.language)
    })
    if (!statusText.textContent) {
      setStatus(t('ready'))
    }
  }

  const translations: Record<string, Record<string, string>> = {
    en: {
      appTitle: 'Codex Skills Manager',
      appSubtitle: 'Local skill registry • Tauri desktop',
      refresh: 'Refresh',
      restartNotice: 'Restart Codex to apply',
      searchPlaceholder: 'Search skills by name, slug, description',
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
      done: 'Done',
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
      copyFailed: 'Copy failed'
    },
    zh: {
      appTitle: 'Codex 技能管理器',
      appSubtitle: '本地技能注册表 • Tauri 桌面端',
      refresh: '刷新',
      restartNotice: '重启 Codex 生效',
      searchPlaceholder: '按名称、slug、描述搜索',
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
      done: '完成',
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
      copyFailed: '复制失败'
    }
  }
  void refreshSkills(true)
  void pollFingerprint()
  if (isTauriEnv) {
    setInterval(() => void pollFingerprint(), REFRESH_INTERVAL_MS)
  }

  applyLanguage()
}
