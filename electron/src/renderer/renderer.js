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
const steamRemoveBtn = document.getElementById('steamRemoveBtn');
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

// Settings & Quest Timer
const settingsModal = document.getElementById('settingsModal');
const settingsBtn = document.getElementById('settingsBtn');
const settingsCloseBtn = document.getElementById('settingsCloseBtn');
const settingsCancelBtn = document.getElementById('settingsCancelBtn');
const settingsSaveBtn = document.getElementById('settingsSaveBtn');
const settingQuestTimerEnabled = document.getElementById('settingQuestTimerEnabled');
const settingQuestDuration = document.getElementById('settingQuestDuration');
const settingAutoStop = document.getElementById('settingAutoStop');
const settingNotify = document.getElementById('settingNotify');
const settingMinimizeToTray = document.getElementById('settingMinimizeToTray');
const questTimerBadge = document.getElementById('questTimerBadge');
const questTimerText = document.getElementById('questTimerText');

// Grid View elements
const heroSection = document.getElementById('heroSection');
const gridSection = document.getElementById('gridSection');
const mainGamesGrid = document.getElementById('mainGamesGrid');
const gridGameCount = document.getElementById('gridGameCount');
const gridEmptyState = document.getElementById('gridEmptyState');
const btnBackToGrid = document.getElementById('btnBackToGrid');
const viewModeListBtn = document.getElementById('viewModeListBtn');
const viewModeGridBtn = document.getElementById('viewModeGridBtn');
let currentViewMode = 'list';

let appSettings = {
  questTimerEnabled: true,
  questDurationMinutes: 15,
  autoStopOnComplete: true,
  notifyOnComplete: true,
  minimizeToTray: true,
  preferredViewMode: 'list'
};

const activeQuestTimers = new Map(); // key -> { startTime, durationMs, game, notified }

function formatTimerRemaining(remainingMs) {
  const totalSeconds = Math.max(0, Math.floor((remainingMs || 0) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

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

  if (questTimerBadge) questTimerBadge.style.display = 'none';

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

  updateQuestTimerDisplay();
  updateDetailsPanel();
}

function updateQuestTimerDisplay() {
  if (!questTimerBadge || !questTimerText) return;

  if (!selectedGame || !isGameRunning(selectedGame) || !appSettings.questTimerEnabled) {
    questTimerBadge.style.display = 'none';
    return;
  }

  const key = makeGameKey(selectedGame);
  const timer = activeQuestTimers.get(key);
  if (!timer) {
    questTimerBadge.style.display = 'none';
    return;
  }

  const remaining = Math.max(0, timer.durationMs - (Date.now() - timer.startTime));
  questTimerBadge.style.display = 'inline-flex';

  if (remaining > 0) {
    questTimerBadge.classList.remove('completed');
    questTimerText.textContent = formatTimerRemaining(remaining);
  } else {
    questTimerBadge.classList.add('completed');
    questTimerText.textContent = '00:00';
  }
}

// Tick quest timers every second
setInterval(() => {
  if (!appSettings.questTimerEnabled && activeQuestTimers.size === 0) return;

  const now = Date.now();
  for (const [key, timer] of Array.from(activeQuestTimers.entries())) {
    const elapsed = now - timer.startTime;
    const remaining = Math.max(0, timer.durationMs - elapsed);

    if (remaining <= 0) {
      if (appSettings.autoStopOnComplete) {
        log(`[Quest Timer] ${timer.game.name} completed ${appSettings.questDurationMinutes}m quest. Auto-stopping process...`, 'log-success');
        if (appSettings.notifyOnComplete && launcherApi.sendNotification) {
          launcherApi.sendNotification({
            title: 'Discord Quest Complete!',
            body: `${timer.game.name} has finished the ${appSettings.questDurationMinutes}-minute quest and was closed.`
          });
        }
        activeQuestTimers.delete(key);
        launcherApi.stopGame(timer.game);
      } else {
        if (!timer.notified) {
          timer.notified = true;
          log(`[Quest Timer] ${timer.game.name} reached ${appSettings.questDurationMinutes}m quest playtime goal!`, 'log-success');
          if (appSettings.notifyOnComplete && launcherApi.sendNotification) {
            launcherApi.sendNotification({
              title: 'Discord Quest Complete!',
              body: `${timer.game.name} has reached ${appSettings.questDurationMinutes} minutes of playtime.`
            });
          }
        }
      }
    }
  }

  updateQuestTimerDisplay();
}, 1000);

function openSettingsModal() {
  if (settingQuestTimerEnabled) settingQuestTimerEnabled.checked = Boolean(appSettings.questTimerEnabled);
  if (settingQuestDuration) settingQuestDuration.value = String(appSettings.questDurationMinutes || 15);
  if (settingAutoStop) settingAutoStop.checked = Boolean(appSettings.autoStopOnComplete);
  if (settingNotify) settingNotify.checked = Boolean(appSettings.notifyOnComplete);
  if (settingMinimizeToTray) settingMinimizeToTray.checked = Boolean(appSettings.minimizeToTray !== false);
  if (settingsModal) settingsModal.style.display = 'flex';
}

function closeSettingsModal() {
  if (settingsModal) settingsModal.style.display = 'none';
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

  if (!detailAppId || !detailExe || !detailRunning) return;

  if (detailSteamItem) {
    detailSteamItem.style.display = 'none';
  }

  if (!selectedGame) {
    detailAppId.textContent = dash;
    detailExe.textContent = dash;
    detailRunning.textContent = dash;
    return;
  }

  detailAppId.textContent = selectedGame.appId || dash;
  detailExe.textContent = selectedGame.exe || dash;
  detailRunning.textContent = isGameRunning(selectedGame) ? 'Yes' : 'No';

  const hasSteamOption = Boolean(
    selectedGame.useSteamPath ||
    selectedGame.requiresSteam ||
    selectedGame.steamAppId
  );

  if (detailSteamItem) {
    detailSteamItem.style.display = hasSteamOption ? 'block' : 'none';
  }

  if (hasSteamOption && detailSteamStatus) {
    const steamId = selectedGame.steamAppId || '3787240';
    if (selectedGame.useSteamPath) {
      detailSteamStatus.textContent = `Configured (Steam AppID: ${steamId})`;
      detailSteamStatus.style.color = 'var(--success)';
    } else if (selectedGame.requiresSteam) {
      detailSteamStatus.textContent = `Required for Discord (Steam AppID: ${steamId})`;
      detailSteamStatus.style.color = 'var(--danger)';
    } else {
      detailSteamStatus.textContent = `Available (Optional) (Steam AppID: ${steamId})`;
      detailSteamStatus.style.color = 'var(--brand)';
    }
  }
}

function getGameCoverCandidates(game) {
  if (!game || typeof game !== 'object') return [];
  const candidates = [];

  const steamId = String(game.steamAppId || '').trim();
  if (steamId) {
    // 1. Steam vertical library poster
    candidates.push(`https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${steamId}/library_600x900.jpg`);
    // 2. Steam header capsule
    candidates.push(`https://cdn.akamai.steamstatic.com/steam/apps/${steamId}/header.jpg`);
  }

  const appId = String(game.appId || game.id || '').trim();
  const coverHash = String(game.coverImageHash || game.cover_image_hash || '').trim();
  if (appId && coverHash) {
    // 3. Discord CDN official cover
    candidates.push(`https://cdn.discordapp.com/app-icons/${appId}/${coverHash}.png?size=512`);
  }

  const iconHash = String(game.iconHash || game.icon_hash || '').trim();
  if (appId && iconHash) {
    // 4. Discord CDN official icon
    candidates.push(`https://cdn.discordapp.com/app-icons/${appId}/${iconHash}.png?size=256`);
  }

  return candidates;
}

function getGameInitials(name) {
  if (!name) return '??';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function renderGridView(filter = '') {
  if (!mainGamesGrid) return;
  mainGamesGrid.innerHTML = '';

  const sortedGames = [...myGames].sort((a, b) => {
    if (a.isFavorite === b.isFavorite) return a.name.localeCompare(b.name);
    return a.isFavorite ? -1 : 1;
  });

  const term = filter.toLowerCase();
  const matchedGames = sortedGames.filter(g => g.name.toLowerCase().includes(term));

  if (gridGameCount) {
    gridGameCount.textContent = `(${matchedGames.length})`;
  }

  if (matchedGames.length === 0) {
    if (gridEmptyState) gridEmptyState.style.display = 'flex';
    return;
  }

  if (gridEmptyState) gridEmptyState.style.display = 'none';

  for (const game of matchedGames) {
    const isRunning = isGameRunning(game);
    const candidates = getGameCoverCandidates(game);
    const initials = getGameInitials(game.name);

    const card = document.createElement('div');
    card.className = `game-card ${selectedGame === game ? 'active' : ''} ${isRunning ? 'running' : ''}`;

    const playBtnSvg = isRunning
      ? `<svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12"/></svg>`
      : `<svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg>`;

    card.innerHTML = `
      <div class="game-card-poster-wrap">
        ${isRunning ? `
          <div class="game-card-badge">
            <span class="game-card-badge-dot"></span>
            <span>Playing</span>
          </div>` : ''}

        <div class="game-card-fav ${game.isFavorite ? 'active' : ''}" title="${game.isFavorite ? 'Remove from favorites' : 'Add to favorites'}">
          ${starSvg}
        </div>

        ${candidates.length > 0 ? `
          <img class="game-card-poster" src="${candidates[0]}" alt="${game.name}" loading="lazy" />
          <div class="game-card-placeholder" style="display: none;">
            <div class="game-card-initials">${initials}</div>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="opacity:0.4;"><rect x="2" y="6" width="20" height="12" rx="3"></rect><circle cx="8" cy="12" r="1.5"></circle><circle cx="16" cy="12" r="1.5"></circle></svg>
          </div>
        ` : `
          <div class="game-card-placeholder">
            <div class="game-card-initials">${initials}</div>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="opacity:0.4;"><rect x="2" y="6" width="20" height="12" rx="3"></rect><circle cx="8" cy="12" r="1.5"></circle><circle cx="16" cy="12" r="1.5"></circle></svg>
          </div>
        `}

        <div class="game-card-overlay">
          <button class="card-btn-play ${isRunning ? 'stop' : ''}" title="${isRunning ? 'Stop Playing' : 'Launch Game'}">
            ${playBtnSvg}
          </button>
        </div>
      </div>

      <div class="game-card-info">
        <div class="game-card-title" title="${game.name}">${game.name}</div>
        <div class="game-card-exe" title="${game.exe || ''}">${game.exe || 'Executable'}</div>
      </div>
    `;

    const img = card.querySelector('.game-card-poster');
    if (img) {
      let candIndex = 0;
      img.onerror = () => {
        candIndex++;
        if (candIndex < candidates.length) {
          img.src = candidates[candIndex];
        } else {
          img.style.display = 'none';
          const placeholder = card.querySelector('.game-card-placeholder');
          if (placeholder) placeholder.style.display = 'flex';
        }
      };
    }

    const favBtn = card.querySelector('.game-card-fav');
    if (favBtn) {
      favBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await toggleFavorite(game);
      });
    }

    const playBtn = card.querySelector('.card-btn-play');
    if (playBtn) {
      playBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await selectGame(game);
        if (launchBtn) launchBtn.click();
      });
    }

    card.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      openGameContextMenu(game, e.clientX, e.clientY);
    });

    card.addEventListener('click', async (e) => {
      if (e.target.closest('.card-btn-play') || e.target.closest('.game-card-fav')) return;
      await selectGame(game);
      showHeroDetailsFromGrid();
    });

    mainGamesGrid.appendChild(card);
  }
}

function setViewMode(mode) {
  currentViewMode = mode;
  if (viewModeListBtn) viewModeListBtn.classList.toggle('active', mode === 'list');
  if (viewModeGridBtn) viewModeGridBtn.classList.toggle('active', mode === 'grid');

  if (mode === 'grid') {
    if (heroSection) heroSection.style.display = 'none';
    if (gridSection) gridSection.style.display = 'flex';
    if (btnBackToGrid) btnBackToGrid.style.display = 'none';
    renderGridView(searchInput ? searchInput.value : '');
  } else {
    if (gridSection) gridSection.style.display = 'none';
    if (heroSection) heroSection.style.display = 'flex';
    if (btnBackToGrid) btnBackToGrid.style.display = 'none';
  }

  appSettings.preferredViewMode = mode;
  if (launcherApi.saveSettings) {
    launcherApi.saveSettings(appSettings).catch(() => {});
  }
}

function showHeroDetailsFromGrid() {
  if (gridSection) gridSection.style.display = 'none';
  if (heroSection) heroSection.style.display = 'flex';
  if (btnBackToGrid) btnBackToGrid.style.display = 'inline-flex';
}

function refreshViews() {
  const query = searchInput ? searchInput.value : '';
  renderMainList(query);
  if (currentViewMode === 'grid' || (gridSection && gridSection.style.display !== 'none')) {
    renderGridView(query);
  }
}

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
      refreshViews();
      updateDetailsPanel();
    }

    log(`Deleted ${game.name} from library.`, 'log-success');
  });
}

async function toggleFavorite(game) {
  const updated = await launcherApi.toggleFavorite(game.appId, game.exe);
  if (updated) {
    game.isFavorite = updated.isFavorite;
    refreshViews();

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

  updateDetailsPanel();

  await launcherApi.selectGame(game);

  syncSelectedGameLaunchState();
  refreshViews();
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

  if (steamRemoveBtn) {
    steamRemoveBtn.style.display = game.useSteamPath ? 'inline-block' : 'none';
  }
  if (steamConfirmBtn) {
    steamConfirmBtn.textContent = game.useSteamPath ? 'Update Manifest' : 'Install to Steam';
  }

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
  refreshViews();

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
      if (appSettings.questTimerEnabled) {
        const durationMs = (appSettings.questDurationMinutes || 15) * 60 * 1000;
        activeQuestTimers.set(selectedKey, {
          startTime: Date.now(),
          durationMs,
          game: selectedGame,
          notified: false
        });
      }
      refreshViews();
      syncSelectedGameLaunchState();
      log(`Process started: ${selectedGame.exe}`, 'log-success');
    } else {
      log(`Failed to launch: ${r.error}`, 'log-danger');
      launchBtn.classList.remove('running');
      resetHeroState();
    }
  } else {
    activeQuestTimers.delete(selectedKey);
    await launcherApi.stopGame(selectedGame);
    runningGames.delete(selectedKey);
    refreshViews();
    syncSelectedGameLaunchState();
    log('Process terminated.', 'log-danger');
  }
});

document.getElementById('openAddModalBtn').onclick = openModal;
document.getElementById('closeModalBtn').onclick = closeModal;

searchInput.addEventListener('input', (e) => {
  renderMainList(e.target.value);
  renderGridView(e.target.value);
});

if (viewModeListBtn) viewModeListBtn.addEventListener('click', () => setViewMode('list'));
if (viewModeGridBtn) viewModeGridBtn.addEventListener('click', () => setViewMode('grid'));
if (btnBackToGrid) btnBackToGrid.addEventListener('click', () => setViewMode('grid'));

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

    try {
      steamConfirmBtn.disabled = true;
      steamConfirmBtn.textContent = 'Installing...';
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

      for (const g of myGames) {
        if (String(g?.appId) === String(gameForSteamSetup.appId)) {
          g.useSteamPath = true;
          g.steamAppId = steamAppId;
          g.installDir = installDir;
          g.exe = exe;
          g.steamExePath = r.destExePath;
        }
      }

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

      closeSteamModal();
      log(`Steam manifest and dummy successfully installed in Steam library!`, 'log-success');
      log(`Important: Restart Steam and Discord if the game is not immediately detected.`, 'log-entry');
      renderMainList(searchInput.value);
    } catch (err) {
      log(`Steam setup error: ${err?.message || err}`, 'log-danger');
    } finally {
      steamConfirmBtn.disabled = false;
      steamConfirmBtn.textContent = gameForSteamSetup?.useSteamPath ? 'Update Manifest' : 'Install to Steam';
    }
  });
}

if (steamRemoveBtn) {
  steamRemoveBtn.addEventListener('click', async () => {
    if (!gameForSteamSetup) return;
    try {
      steamRemoveBtn.disabled = true;
      steamRemoveBtn.textContent = 'Removing...';
      log(`Removing Steam manifest and dummy for ${gameForSteamSetup.name}...`);

      const r = await launcherApi.removeSteamIntegration({
        appId: gameForSteamSetup.appId,
        steamAppId: gameForSteamSetup.steamAppId,
        installDir: gameForSteamSetup.installDir
      });

      if (!r?.ok) {
        log(`Failed to remove from Steam: ${r?.error || 'unknown error'}`, 'log-danger');
        return;
      }

      gameForSteamSetup.useSteamPath = false;
      delete gameForSteamSetup.steamExePath;

      for (const g of myGames) {
        if (String(g?.appId) === String(gameForSteamSetup.appId)) {
          g.useSteamPath = false;
          delete g.steamExePath;
        }
      }

      if (selectedGame && String(selectedGame.appId) === String(gameForSteamSetup.appId)) {
        selectedGame.useSteamPath = false;
        delete selectedGame.steamExePath;
        updateDetailsPanel();
      }

      closeSteamModal();
      log(`Successfully removed ${gameForSteamSetup.name} from Steam library.`, 'log-success');
      log(`Restart Steam to refresh your Steam library list.`, 'log-entry');
      renderMainList(searchInput.value);
    } catch (err) {
      log(`Error removing from Steam: ${err?.message || err}`, 'log-danger');
    } finally {
      steamRemoveBtn.disabled = false;
      steamRemoveBtn.textContent = 'Remove from Steam';
    }
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

if (settingsBtn) settingsBtn.addEventListener('click', openSettingsModal);
if (settingsCloseBtn) settingsCloseBtn.addEventListener('click', closeSettingsModal);
if (settingsCancelBtn) settingsCancelBtn.addEventListener('click', closeSettingsModal);

if (settingsSaveBtn) {
  settingsSaveBtn.addEventListener('click', async () => {
    appSettings = {
      questTimerEnabled: settingQuestTimerEnabled ? settingQuestTimerEnabled.checked : true,
      questDurationMinutes: settingQuestDuration ? parseInt(settingQuestDuration.value, 10) || 15 : 15,
      autoStopOnComplete: settingAutoStop ? settingAutoStop.checked : true,
      notifyOnComplete: settingNotify ? settingNotify.checked : true,
      minimizeToTray: settingMinimizeToTray ? settingMinimizeToTray.checked : true
    };
    if (launcherApi.saveSettings) {
      await launcherApi.saveSettings(appSettings);
    }
    closeSettingsModal();
    log('Settings updated.', 'log-success');
    updateQuestTimerDisplay();
  });
}

launcherApi.onGameExited((payload = {}) => {
  const exitedKey = payload && payload.gameKey ? String(payload.gameKey) : '';
  if (!exitedKey) return;

  activeQuestTimers.delete(exitedKey);
  runningGames.delete(exitedKey);
  refreshViews();
  if (selectedGame && makeGameKey(selectedGame) === exitedKey) {
    syncSelectedGameLaunchState();
    log('Process exited.', 'log-danger');
  }
  updateQuestTimerDisplay();
  updateDetailsPanel();
});

(async function init() {
  if (launcherApi.getSettings) {
    try {
      const s = await launcherApi.getSettings();
      if (s && typeof s === 'object') appSettings = { ...appSettings, ...s };
    } catch {}
  }

  await ensureDatabaseSynced();
  await refreshMyGames();

  if (appSettings.preferredViewMode === 'grid') {
    setViewMode('grid');
  } else {
    setViewMode('list');
  }

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