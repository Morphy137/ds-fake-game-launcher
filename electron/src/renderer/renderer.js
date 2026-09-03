/* global launcherApi */

const starSvg = `<svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`;

let myGames = [];
let selectedGame = null;
let runningGames = new Set();

let modalState = {
  filter: '',
  offset: 0,
  limit: 200,
  hasMore: false,
  loading: false
};

const gameListEl = document.getElementById('gameList');
const heroEmptyState = document.getElementById('heroEmptyState');
const heroContent = document.getElementById('heroContent');
const mainContent = document.getElementById('mainContent');

const launchBtn = document.getElementById('launchBtn');
const logArea = document.getElementById('logArea');
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');

const addGameModal = document.getElementById('addGameModal');
const modalListEl = document.getElementById('modalList');
const searchInput = document.getElementById('searchInput');
const modalSearchInput = document.getElementById('modalSearchInput');
const contextMenuEl = document.getElementById('contextMenu');

// Update modal
const updateModal = document.getElementById('updateModal');
const updateCloseBtn = document.getElementById('updateCloseBtn');
const updateSubtitle = document.getElementById('updateSubtitle');
const updateNotes = document.getElementById('updateNotes');
const updateInstallBtn = document.getElementById('updateInstallBtn');
const updateRemindBtn = document.getElementById('updateRemindBtn');
const updateProgressWrap = document.getElementById('updateProgressWrap');
const updateProgressFill = document.getElementById('updateProgressFill');
const updateProgressText = document.getElementById('updateProgressText');

// Details panel
const detailAppId = document.getElementById('detailAppId');
const detailExe = document.getElementById('detailExe');
const detailFavorite = document.getElementById('detailFavorite');
const detailRunning = document.getElementById('detailRunning');
const editExeBtn = document.getElementById('editExeBtn');

// Edit Executable modal
const editExeModal = document.getElementById('editExeModal');
const editExeCloseBtn = document.getElementById('editExeCloseBtn');
const editExeCancelBtn = document.getElementById('editExeCancelBtn');
const editExeSaveBtn = document.getElementById('editExeSaveBtn');
const editExeInput = document.getElementById('editExeInput');
const editExeSubtitle = document.getElementById('editExeSubtitle');
let gameBeingEdited = null;

// Steam Integration modal & details
const steamModal = document.getElementById('steamModal');
const steamCloseBtn = document.getElementById('steamCloseBtn');
const steamCancelBtn = document.getElementById('steamCancelBtn');
const steamConfirmBtn = document.getElementById('steamConfirmBtn');
const steamAppIdInput = document.getElementById('steamAppIdInput');
const steamInstallDirInput = document.getElementById('steamInstallDirInput');
const steamExeRelInput = document.getElementById('steamExeRelInput');
const detailSteamStatus = document.getElementById('detailSteamStatus');
const steamActionBtn = document.getElementById('steamActionBtn');
let gameForSteamSetup = null;

let updateUiState = {
  visible: false,
  installing: false
};

function log(msg, type = '') {
  const div = document.createElement('div');
  div.className = `log-entry ${type}`;
  const t = new Date().toLocaleTimeString([], { hour12: false });
  div.innerHTML = `<span class="log-time">[${t}]</span> ${msg}`;
  logArea.appendChild(div);
  logArea.scrollTop = logArea.scrollHeight;
}

function resetHeroState() {
  statusDot.style.backgroundColor = 'var(--text-muted)';
  statusDot.style.color = 'var(--text-muted)';
  statusText.innerText = 'Ready';
  statusText.style.color = 'var(--text-muted)';

  launchBtn.classList.remove('running');
  document.getElementById('launchBtnText').innerText = 'Launch Game';
  document.getElementById('playIcon').style.display = 'block';
  document.getElementById('stopIcon').style.display = 'none';

  updateDetailsPanel();
}

function syncSelectedGameLaunchState() {
  if (!selectedGame) {
    resetHeroState();
    return;
  }

  const running = isGameRunning(selectedGame);
  if (!running) {
    resetHeroState();
    return;
  }

  statusDot.style.backgroundColor = 'var(--success)';
  statusDot.style.color = 'var(--success)';
  statusText.innerText = 'Playing Now';
  statusText.style.color = 'var(--success)';

  launchBtn.classList.add('running');
  document.getElementById('launchBtnText').innerText = 'Stop Playing';
  document.getElementById('playIcon').style.display = 'none';
  document.getElementById('stopIcon').style.display = 'block';

  updateDetailsPanel();
}

function makeGameKey(game) {
  if (!game || typeof game !== 'object') return '';
  const appId = String(game.appId ?? '');
  const exe = String(game.exe ?? '');
  const key = `${appId}::${exe}`;
  return key === '::' ? '' : key;
}

function isGameRunning(game) {
  return Boolean(game && makeGameKey(game) && runningGames.has(makeGameKey(game)));
}

function updateDetailsPanel() {
  const dash = '—';

  if (!detailAppId || !detailExe || !detailFavorite || !detailRunning) return;

  if (!selectedGame) {
    detailAppId.textContent = dash;
    detailExe.textContent = dash;
    detailFavorite.textContent = dash;
    detailRunning.textContent = dash;
    return;
  }

  detailAppId.textContent = selectedGame.appId || dash;
  detailExe.textContent = selectedGame.exe || dash;
  detailFavorite.textContent = selectedGame.isFavorite ? 'Yes' : 'No';
  detailRunning.textContent = isGameRunning(selectedGame) ? 'Yes' : 'No';

  if (detailSteamStatus) {
    if (selectedGame.useSteamPath) {
      detailSteamStatus.textContent = `Configured (Steam AppID: ${selectedGame.steamAppId || '3787240'})`;
      detailSteamStatus.style.color = 'var(--success)';
    } else if (selectedGame.steamAppId || selectedGame.name.toLowerCase().includes('tokon')) {
      const id = selectedGame.steamAppId || '3787240';
      detailSteamStatus.textContent = `Available (Steam AppID: ${id}) — Click to setup`;
      detailSteamStatus.style.color = 'var(--brand)';
    } else {
      detailSteamStatus.textContent = 'Not Configured (Click to setup)';
      detailSteamStatus.style.color = 'var(--text-muted)';
    }
  }
}

// No background thumbnails in the public build.

function renderMainList(filter = '') {
  gameListEl.innerHTML = '';

  const sortedGames = [...myGames].sort((a, b) => {
    if (a.isFavorite === b.isFavorite) return a.name.localeCompare(b.name);
    return a.isFavorite ? -1 : 1;
  });

  const term = filter.toLowerCase();
  for (const game of sortedGames) {
    if (!game.name.toLowerCase().includes(term)) continue;

    const div = document.createElement('div');
    const running = isGameRunning(game);
    div.className = `game-item ${selectedGame === game ? 'active' : ''} ${game.isFavorite ? 'favorite' : ''}`;

    div.innerHTML = `
      <div class="game-status-dot ${running ? 'active' : ''}" aria-label="${running ? 'Running' : 'Stopped'}"></div>
      <div style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${game.name}</div>
      <div class="fav-icon">${starSvg}</div>
    `;

    div.addEventListener('click', async (e) => {
      if (e.target.closest('.fav-icon')) {
        await toggleFavorite(game);
      } else {
        await selectGame(game);
      }
    });

    div.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      openGameContextMenu(game, e.clientX, e.clientY);
    });

    gameListEl.appendChild(div);
  }
}

function closeContextMenu() {
  contextMenuEl.style.display = 'none';
  contextMenuEl.innerHTML = '';
}

function openGameContextMenu(game, x, y) {
  if (!game) return;

  contextMenuEl.innerHTML = `
    <div class="context-menu-item" id="ctxEditExe">Edit executable</div>
    <div class="context-menu-item" id="ctxSteam">Setup Steam manifest</div>
    <div class="context-menu-item" id="ctxShortcut">Create shortcut</div>
    <div class="context-menu-item danger" id="ctxDelete">Delete from library</div>
  `;

  const margin = 8;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  contextMenuEl.style.display = 'block';

  // Position first, then clamp after layout
  contextMenuEl.style.left = `${x}px`;
  contextMenuEl.style.top = `${y}px`;

  requestAnimationFrame(() => {
    const rect = contextMenuEl.getBoundingClientRect();
    let left = x;
    let top = y;

    if (left + rect.width + margin > vw) left = Math.max(margin, vw - rect.width - margin);
    if (top + rect.height + margin > vh) top = Math.max(margin, vh - rect.height - margin);

    contextMenuEl.style.left = `${left}px`;
    contextMenuEl.style.top = `${top}px`;
  });

  const editExeCtxBtn = document.getElementById('ctxEditExe');
  const ctxSteamBtn = document.getElementById('ctxSteam');
  const shortcutBtn = document.getElementById('ctxShortcut');
  const deleteBtn = document.getElementById('ctxDelete');

  editExeCtxBtn.addEventListener('click', () => {
    closeContextMenu();
    openEditExeModal(game);
  });

  ctxSteamBtn.addEventListener('click', () => {
    closeContextMenu();
    openSteamModal(game);
  });

  shortcutBtn.addEventListener('click', async () => {
    closeContextMenu();
    log(`Creating shortcut for ${game.name}...`);

    const r = await launcherApi.createShortcut(game.appId, game.exe);
    if (!r?.ok) {
      log(`Shortcut failed: ${r?.error || 'unknown error'}`, 'log-danger');
      return;
    }

    log(`Shortcut created: ${r.path}`, 'log-success');
  });

  deleteBtn.addEventListener('click', async () => {
    // Avoid deleting the currently running selection
      if (isGameRunning(game) && selectedGame && makeGameKey(selectedGame) === makeGameKey(game)) {
      log('Stop the running game before deleting it.', 'log-danger');
      closeContextMenu();
      return;
    }

    await launcherApi.deleteGame(game.appId, game.exe);
    closeContextMenu();
    await refreshMyGames();

    // If deleted selected game (not running), clear selection
    if (selectedGame && selectedGame.appId === game.appId && selectedGame.exe === game.exe) {
      selectedGame = null;
      heroEmptyState.style.display = 'flex';
      heroContent.style.display = 'none';
      renderMainList(searchInput.value);
      updateDetailsPanel();
    }

    log(`Deleted ${game.name} from library.`, 'log-success');
  });
}

async function toggleFavorite(game) {
  const updated = await launcherApi.toggleFavorite(game.appId, game.exe);
  if (updated) {
    game.isFavorite = updated.isFavorite;
    renderMainList(searchInput.value);

    if (selectedGame && selectedGame.appId === game.appId && selectedGame.exe === game.exe) {
      selectedGame.isFavorite = updated.isFavorite;
      updateDetailsPanel();
    }
  }
}

async function selectGame(game) {
  selectedGame = game;

  heroEmptyState.style.display = 'none';
  heroContent.style.display = 'flex';

  document.getElementById('heroTitle').innerText = game.name;
  document.getElementById('heroExe').innerText = game.exe;

  updateDetailsPanel();

  await launcherApi.selectGame(game);

  syncSelectedGameLaunchState();
  renderMainList(searchInput.value);
}

function openModal() {
  addGameModal.style.display = 'flex';
  modalSearchInput.value = '';
  resetAndRenderModal('');
}

function closeModal() {
  addGameModal.style.display = 'none';
}

function openEditExeModal(game) {
  if (!game) return;
  if (isGameRunning(game)) {
    log(`Stop ${game.name} before editing its executable.`, 'log-danger');
    return;
  }

  gameBeingEdited = game;
  if (editExeSubtitle) {
    editExeSubtitle.textContent = `Override process name for "${game.name}":`;
  }
  if (editExeInput) {
    editExeInput.value = game.exe || '';
  }
  if (editExeModal) {
    editExeModal.style.display = 'flex';
  }
  setTimeout(() => {
    editExeInput?.focus();
    editExeInput?.select();
  }, 50);
}

function closeEditExeModal() {
  if (editExeModal) {
    editExeModal.style.display = 'none';
  }
  gameBeingEdited = null;
}

function openSteamModal(game) {
  if (!game) return;
  gameForSteamSetup = game;

  let defaultSteamAppId = game.steamAppId || '';
  let defaultInstallDir = game.installDir || '';
  let defaultExeRel = game.exe || '';

  // Smart defaults for Marvel Tokon
  if (game.name && game.name.toLowerCase().includes('tokon')) {
    if (!defaultSteamAppId) defaultSteamAppId = '3787240';
    if (!defaultInstallDir) defaultInstallDir = 'MTFS';
    if (!defaultExeRel || !defaultExeRel.includes('MTFSSteam')) {
      defaultExeRel = 'Binaries/Win64/MTFSSteam-Win64-Shipping.exe';
    }
  }

  if (steamAppIdInput) steamAppIdInput.value = defaultSteamAppId;
  if (steamInstallDirInput) steamInstallDirInput.value = defaultInstallDir || game.name.replace(/[<>:"/\\|?*]/g, '_').trim();
  if (steamExeRelInput) steamExeRelInput.value = defaultExeRel;

  if (steamModal) steamModal.style.display = 'flex';
}

function closeSteamModal() {
  if (steamModal) steamModal.style.display = 'none';
  gameForSteamSetup = null;
}

function showUpdateModal(payload) {
  if (!payload || !updateModal) return;

  updateUiState.visible = true;
  updateUiState.installing = false;

  updateInstallBtn.disabled = false;
  updateRemindBtn.disabled = false;
  updateInstallBtn.textContent = 'Install update';

  const version = payload.version ? `v${payload.version}` : 'New version';
  updateSubtitle.textContent = payload.releaseName
    ? `${version} — ${payload.releaseName}`
    : version;

  updateNotes.innerHTML = renderReleaseNotesHtml(payload.releaseNotes);

  if (updateProgressWrap) {
    updateProgressWrap.style.display = 'none';
    updateProgressFill.style.width = '0%';
    updateProgressText.textContent = 'Downloading update…';
  }

  updateModal.style.display = 'flex';
}

function hideUpdateModal() {
  updateUiState.visible = false;
  updateUiState.installing = false;
  updateModal.style.display = 'none';
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 MB';
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)} MB`;
}

function setUpdateProgress(percent, payload) {
  if (!updateProgressWrap) return;
  updateProgressWrap.style.display = 'block';

  const pct = Math.max(0, Math.min(100, Math.round(percent)));
  updateProgressFill.style.width = `${pct}%`;

  if (payload && Number.isFinite(payload.total) && payload.total > 0) {
    const speed = payload.bytesPerSecond ? ` — ${formatBytes(payload.bytesPerSecond)}/s` : '';
    updateProgressText.textContent =
      `Downloading update… ${pct}% (${formatBytes(payload.transferred)} / ${formatBytes(payload.total)})${speed}`;
  } else {
    updateProgressText.textContent = `Downloading update… ${pct}%`;
  }
}

// --- RELEASE NOTES SANITIZER/RENDERER ---
// GitHub release notes arrive as HTML (markdown already converted upstream).
// We only allow a small whitelist of formatting tags and strip everything
// else (including <img> tags entirely, per design) to avoid XSS and to keep
// the rendered notes looking like the GitHub release page.
const RELEASE_NOTES_ALLOWED_TAGS = new Set([
  'P', 'BR', 'STRONG', 'B', 'EM', 'I', 'U', 'S',
  'UL', 'OL', 'LI', 'A', 'CODE', 'PRE', 'BLOCKQUOTE',
  'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'HR', 'SPAN'
]);
const RELEASE_NOTES_DROP_TAGS = new Set([
  'IMG', 'SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED',
  'VIDEO', 'AUDIO', 'SVG', 'LINK', 'META', 'FORM', 'INPUT', 'BUTTON'
]);
const RELEASE_NOTES_SAFE_URL_RE = /^(https?:|mailto:)/i;

function sanitizeReleaseNotesNode(node) {
  const children = Array.from(node.childNodes);
  for (const child of children) {
    if (child.nodeType === Node.COMMENT_NODE) {
      child.remove();
      continue;
    }
    if (child.nodeType !== Node.ELEMENT_NODE) continue;

    const tag = child.tagName;

    if (RELEASE_NOTES_DROP_TAGS.has(tag)) {
      child.remove();
      continue;
    }

    for (const attr of Array.from(child.attributes)) {
      const name = attr.name.toLowerCase();
      if (tag === 'A' && name === 'href') {
        if (!RELEASE_NOTES_SAFE_URL_RE.test(attr.value.trim())) child.removeAttribute(attr.name);
        continue;
      }
      child.removeAttribute(attr.name);
    }

    if (tag === 'A') {
      child.setAttribute('target', '_blank');
      child.setAttribute('rel', 'noopener noreferrer');
    }

    if (!RELEASE_NOTES_ALLOWED_TAGS.has(tag)) {
      sanitizeReleaseNotesNode(child);
      while (child.firstChild) node.insertBefore(child.firstChild, child);
      child.remove();
      continue;
    }

    sanitizeReleaseNotesNode(child);
  }
}

function renderReleaseNotesHtml(rawNotes) {
  const text = String(rawNotes || '').trim();
  if (!text) return '<p style="color:var(--text-muted);">No release notes provided.</p>';

  // Plain text (no HTML tags) - escape and preserve line breaks.
  if (!/<[a-z!/][\s\S]*>/i.test(text)) {
    const escapeDiv = document.createElement('div');
    escapeDiv.textContent = text;
    return `<p>${escapeDiv.innerHTML.replace(/\n/g, '<br>')}</p>`;
  }

  const doc = new DOMParser().parseFromString(`<div id="release-notes-root">${text}</div>`, 'text/html');
  const root = doc.getElementById('release-notes-root');
  if (!root) return '';

  sanitizeReleaseNotesNode(root);
  return root.innerHTML;
}
// ------------------------------------------

function debounce(fn, waitMs) {
  let t = null;
  return (...args) => {
    if (t) window.clearTimeout(t);
    t = window.setTimeout(() => fn(...args), waitMs);
  };
}

function resetAndRenderModal(filter) {
    updateDetailsPanel();
  modalState = {
    filter: String(filter || ''),
    offset: 0,
    limit: 200,
    hasMore: false,
    loading: false
  };
  modalListEl.innerHTML = '';
  renderNextModalPage();
}

// --- NEW DETECTION WARNING PROMISE HELPERS ---
function promptDetectionWarning() {
  return new Promise((resolve) => {
    const modal = document.getElementById('warningModal');
    const closeBtn = document.getElementById('warningCloseBtn');
    const cancelBtn = document.getElementById('warningCancelBtn');
    const confirmBtn = document.getElementById('warningConfirmBtn');

    if (!modal) return resolve(true);

    modal.style.display = 'flex';

    const handleChoice = (proceed) => {
      modal.style.display = 'none';
      closeBtn.onclick = null;
      cancelBtn.onclick = null;
      confirmBtn.onclick = null;
      resolve(proceed);
    };

    closeBtn.onclick = () => handleChoice(false);
    cancelBtn.onclick = () => handleChoice(false);
    confirmBtn.onclick = () => handleChoice(true);
  });
}
// ---------------------------------------------

async function renderNextModalPage() {
  if (modalState.loading) return;
  modalState.loading = true;

  let page;
  try {
    page = await launcherApi.getDatabaseGames(modalState.filter, modalState.offset, modalState.limit);
  } catch (e) {
    modalState.loading = false;
    modalListEl.innerHTML = `<div style="padding:20px; text-align:center;">Database not ready. Try again. (${String(e.message || e)})</div>`;
      updateDetailsPanel();
    return;
  }

  const frag = document.createDocumentFragment();
  const items = Array.isArray(page?.items) ? page.items : [];

  for (const game of items) {
    if (myGames.some(mg => mg.appId === game.id && mg.exe === game.exe)) continue;

    const div = document.createElement('div');
    updateDetailsPanel();
    div.className = 'modal-item';
    div.innerHTML = `
      <div class="modal-item-info">
        <span class="modal-item-name">${game.name}</span>
        <span class="modal-item-exe">${game.exe}</span>
      </div>
      <div style="color:var(--brand); font-weight:bold; font-size:12px;">+ ADD</div>
    `;

    div.onclick = async () => {
      // --- CHECK DETECTION FLAG BEFORE ADDING ---
      if (game.usesNewDetection) {
        const userWantsToProceed = await promptDetectionWarning();
        if (!userWantsToProceed) {
          log(`Cancelled adding ${game.name}.`, 'log-entry');
          return; // Abort silently
        }
      }
      // ------------------------------------------

      const installed = await launcherApi.addGame(game);
      log(`Installed ${installed.name} successfully.`, 'log-success');
      closeModal();
      await refreshMyGames();
      await selectGame(myGames[myGames.length - 1]);
    };

    frag.appendChild(div);
  }

  modalListEl.appendChild(frag);

  const hasAnyRows = modalListEl.querySelector('.modal-item') != null;
  if (!hasAnyRows && modalState.offset === 0) {
    modalListEl.innerHTML = `<div style="padding:20px; text-align:center;">No results.</div>`;
  }

  modalState.hasMore = Boolean(page?.hasMore);
  modalState.offset += Number.isFinite(page?.items?.length) ? page.items.length : items.length;
  modalState.loading = false;
}

async function refreshMyGames() {
  myGames = await launcherApi.getMyGames();
  renderMainList(searchInput.value);

  // Empty state by default
  if (!myGames.length) {
    selectedGame = null;
    heroEmptyState.style.display = 'flex';
    heroContent.style.display = 'none';
  }
}

async function ensureDatabaseSynced() {
  try {
    const r = await launcherApi.syncGameList();
    log(r.updated ? 'Updated gamelist.json from Discord API.' : 'gamelist.json already up-to-date.', 'log-success');
  } catch (e) {
    log(`Could not sync gamelist.json: ${String(e.message || e)}`, 'log-danger');
  }
}

launchBtn.addEventListener('click', async () => {
  if (!selectedGame) return;

  const selectedKey = makeGameKey(selectedGame);
  const currentlyRunning = isGameRunning(selectedGame);

  if (!currentlyRunning) {
    launchBtn.classList.add('running');
    document.getElementById('launchBtnText').innerText = 'Stop Playing';
    document.getElementById('playIcon').style.display = 'none';
    document.getElementById('stopIcon').style.display = 'block';

    statusDot.style.backgroundColor = 'var(--success)';
    statusDot.style.color = 'var(--success)';
    statusText.innerText = 'Playing Now';
    statusText.style.color = 'var(--success)';

    const r = await launcherApi.launchGame(selectedGame);
    if (r.ok) {
      runningGames.add(selectedKey);
      renderMainList(searchInput.value);
      syncSelectedGameLaunchState();
      log(`Process started: ${selectedGame.exe}`, 'log-success');
    } else {
      log(`Failed to launch: ${r.error}`, 'log-danger');
      launchBtn.classList.remove('running');
      resetHeroState();
    }
  } else {
    await launcherApi.stopGame(selectedGame);
    runningGames.delete(selectedKey);
    renderMainList(searchInput.value);
    syncSelectedGameLaunchState();
    log('Process terminated.', 'log-danger');
  }
});

document.getElementById('openAddModalBtn').onclick = openModal;
document.getElementById('closeModalBtn').onclick = closeModal;
searchInput.addEventListener('input', (e) => renderMainList(e.target.value));
const onModalSearch = debounce((value) => resetAndRenderModal(value), 200);
modalSearchInput.addEventListener('input', (e) => onModalSearch(e.target.value));

modalListEl.addEventListener('scroll', () => {
  if (!addGameModal || addGameModal.style.display !== 'flex') return;
  if (!modalState.hasMore) return;
  if (modalState.loading) return;

  const remaining = modalListEl.scrollHeight - (modalListEl.scrollTop + modalListEl.clientHeight);
  if (remaining < 250) {
    renderNextModalPage();
  }
});

// Close context menu on outside click / escape
document.addEventListener('click', (e) => {
  if (contextMenuEl.style.display === 'none') return;
  if (e.target && contextMenuEl.contains(e.target)) return;
  closeContextMenu();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeContextMenu();
});

window.addEventListener('blur', () => closeContextMenu());

// Update modal events
if (updateCloseBtn) {
  updateCloseBtn.addEventListener('click', async () => {
    await launcherApi.remindUpdateLater();
    hideUpdateModal();
  });
}

if (updateRemindBtn) {
  updateRemindBtn.addEventListener('click', async () => {
    await launcherApi.remindUpdateLater();
    hideUpdateModal();
  });
}

if (updateInstallBtn) {
  updateInstallBtn.addEventListener('click', async () => {
    if (updateUiState.installing) return;
    updateUiState.installing = true;
    updateInstallBtn.disabled = true;
    updateRemindBtn.disabled = true;
    updateInstallBtn.textContent = 'Downloading…';
    setUpdateProgress(0, null);

    const r = await launcherApi.installUpdate();
    if (!r?.ok) {
      log(`Update failed: ${r?.error || 'unknown error'}`, 'log-danger');
      updateUiState.installing = false;
      updateInstallBtn.disabled = false;
      updateRemindBtn.disabled = false;
      updateInstallBtn.textContent = 'Install update';
      if (updateProgressWrap) updateProgressWrap.style.display = 'none';
    }
  });
}

// Edit Executable modal events
if (editExeCloseBtn) editExeCloseBtn.addEventListener('click', closeEditExeModal);
if (editExeCancelBtn) editExeCancelBtn.addEventListener('click', closeEditExeModal);

if (editExeSaveBtn) {
  editExeSaveBtn.addEventListener('click', async () => {
    if (!gameBeingEdited) return;
    const newExe = editExeInput ? editExeInput.value.trim() : '';
    if (!newExe) {
      log('Executable name cannot be empty.', 'log-danger');
      return;
    }

    const oldExe = gameBeingEdited.exe;
    const targetGame = gameBeingEdited;

    const r = await launcherApi.updateGameExecutable(targetGame.appId, oldExe, newExe);
    if (!r?.ok) {
      log(`Failed to update executable: ${r?.error || 'unknown error'}`, 'log-danger');
      return;
    }

    targetGame.exe = r.updatedGame.exe;
    log(`Updated executable for ${targetGame.name} to "${targetGame.exe}".`, 'log-success');

    closeEditExeModal();

    if (selectedGame && String(selectedGame.appId) === String(targetGame.appId)) {
      selectedGame.exe = targetGame.exe;
      const heroExeEl = document.getElementById('heroExe');
      if (heroExeEl) heroExeEl.innerText = targetGame.exe;
      updateDetailsPanel();
    }

    renderMainList(searchInput.value);
  });
}

if (editExeInput) {
  editExeInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      editExeSaveBtn?.click();
    } else if (e.key === 'Escape') {
      closeEditExeModal();
    }
  });
}

if (editExeBtn) {
  editExeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (selectedGame) openEditExeModal(selectedGame);
  });
}

if (detailExe) {
  detailExe.addEventListener('click', () => {
    if (selectedGame && !isGameRunning(selectedGame)) {
      openEditExeModal(selectedGame);
    }
  });
}

// Steam Integration events
if (steamCloseBtn) steamCloseBtn.addEventListener('click', closeSteamModal);
if (steamCancelBtn) steamCancelBtn.addEventListener('click', closeSteamModal);

if (steamConfirmBtn) {
  steamConfirmBtn.addEventListener('click', async () => {
    if (!gameForSteamSetup) return;
    const steamAppId = steamAppIdInput ? steamAppIdInput.value.trim() : '';
    const installDir = steamInstallDirInput ? steamInstallDirInput.value.trim() : '';
    const exe = steamExeRelInput ? steamExeRelInput.value.trim() : '';

    if (!steamAppId) {
      log('Steam App ID is required.', 'log-danger');
      return;
    }

    log(`Configuring Steam manifest for ${gameForSteamSetup.name} (AppID: ${steamAppId})...`);
    const r = await launcherApi.setupSteamIntegration({
      appId: gameForSteamSetup.appId,
      steamAppId,
      installDir,
      exe
    });

    if (!r?.ok) {
      log(`Steam setup failed: ${r?.error || 'unknown error'}`, 'log-danger');
      return;
    }

    gameForSteamSetup.useSteamPath = true;
    gameForSteamSetup.steamAppId = steamAppId;
    gameForSteamSetup.installDir = installDir;
    gameForSteamSetup.exe = exe;
    gameForSteamSetup.steamExePath = r.destExePath;

    closeSteamModal();
    log(`Steam manifest and dummy successfully installed in Steam library!`, 'log-success');
    log(`Important: Restart Steam and Discord if the game is not immediately detected.`, 'log-entry');

    if (selectedGame && String(selectedGame.appId) === String(gameForSteamSetup.appId)) {
      selectedGame.useSteamPath = true;
      selectedGame.steamAppId = steamAppId;
      selectedGame.installDir = installDir;
      selectedGame.exe = exe;
      selectedGame.steamExePath = r.destExePath;
      const heroExeEl = document.getElementById('heroExe');
      if (heroExeEl) heroExeEl.innerText = exe;
      updateDetailsPanel();
    }

    renderMainList(searchInput.value);
  });
}

if (steamActionBtn) {
  steamActionBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (selectedGame) openSteamModal(selectedGame);
  });
}

if (detailSteamStatus) {
  detailSteamStatus.addEventListener('click', () => {
    if (selectedGame) openSteamModal(selectedGame);
  });
}

const detailSteamItem = document.getElementById('detailSteamItem');
if (detailSteamItem) {
  detailSteamItem.style.cursor = 'pointer';
  detailSteamItem.addEventListener('click', (e) => {
    if (e.target.closest('#steamActionBtn') || e.target.closest('#detailSteamStatus')) return;
    if (selectedGame) openSteamModal(selectedGame);
  });
}

// Window controls
const minBtn = document.getElementById('minBtn');
const closeBtn = document.getElementById('closeBtn');
minBtn.addEventListener('click', () => launcherApi.minimize());
closeBtn.addEventListener('click', () => launcherApi.close());

launcherApi.onGameExited((payload = {}) => {
  const exitedKey = payload && payload.gameKey ? String(payload.gameKey) : '';
  if (!exitedKey) return;

  runningGames.delete(exitedKey);
  renderMainList(searchInput.value);
  if (selectedGame && makeGameKey(selectedGame) === exitedKey) {
    syncSelectedGameLaunchState();
    log('Process exited.', 'log-danger');
  }
  updateDetailsPanel();
});

(async function init() {
  await ensureDatabaseSynced();
  await refreshMyGames();
  renderMainList('');

  // Update notifications
  if (launcherApi.onUpdateAvailable) {
    launcherApi.onUpdateAvailable((payload) => {
      showUpdateModal(payload);
      log('Update available.', 'log-success');
    });
  }
  if (launcherApi.onUpdateProgress) {
    launcherApi.onUpdateProgress((payload) => {
      setUpdateProgress(payload?.percent || 0, payload);
    });
  }
  if (launcherApi.onUpdateDownloaded) {
    launcherApi.onUpdateDownloaded(async () => {
      setUpdateProgress(100, null);
      if (updateProgressText) updateProgressText.textContent = 'Download complete. Installing…';
      if (updateInstallBtn) updateInstallBtn.textContent = 'Installing…';
      log('Update downloaded. Installing…', 'log-success');
      // Opens the downloaded installer and quits this app so it can run.
      await launcherApi.quitAndInstallUpdate();
    });
  }
  if (launcherApi.onUpdateError) {
    launcherApi.onUpdateError((payload) => {
      log(`Update error: ${payload?.message || 'unknown error'}`, 'log-danger');
    });
  }
})();