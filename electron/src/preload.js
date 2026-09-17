const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('launcherApi', {
  // Window
  minimize: () => ipcRenderer.invoke('app/window/minimize'),
  toggleMaximize: () => ipcRenderer.invoke('app/window/toggleMaximize'),
  isMaximized: () => ipcRenderer.invoke('app/window/isMaximized'),
  close: () => ipcRenderer.invoke('app/window/close'),
  onMaximizedChanged: (handler) => {
    ipcRenderer.removeAllListeners('app/window/maximizedChanged');
    ipcRenderer.on('app/window/maximizedChanged', (_evt, maximized) => handler(Boolean(maximized)));
  },

  // Data
  syncGameList: () => ipcRenderer.invoke('launcher/syncGameList'),
  getDatabaseGames: (filter, offset, limit) => ipcRenderer.invoke('launcher/getDatabaseGames', { filter, offset, limit }),
  getMyGames: () => ipcRenderer.invoke('launcher/getMyGames'),
  addGame: (game) => ipcRenderer.invoke('launcher/addGame', game),
  toggleFavorite: (appId, exe) => ipcRenderer.invoke('launcher/toggleFavorite', { appId, exe }),
  deleteGame: (appId, exe) => ipcRenderer.invoke('launcher/deleteGame', { appId, exe }),
  updateGameExecutable: (appId, oldExe, newExe) => ipcRenderer.invoke('launcher/updateGameExecutable', { appId, oldExe, newExe }),
  getSteamPath: () => ipcRenderer.invoke('launcher/getSteamPath'),
  setupSteamIntegration: (params) => ipcRenderer.invoke('launcher/setupSteamIntegration', params),
  removeSteamIntegration: (params) => ipcRenderer.invoke('launcher/removeSteamIntegration', params),
  createShortcut: (appId, exe) => ipcRenderer.invoke('launcher/createShortcut', { appId, exe }),

  // Settings & System
  getSettings: () => ipcRenderer.invoke('settings/get'),
  saveSettings: (settings) => ipcRenderer.invoke('settings/set', settings),
  sendNotification: (payload) => ipcRenderer.invoke('system/sendNotification', payload),

  // Run
  selectGame: (game) => ipcRenderer.invoke('launcher/selectGame', game),
  launchGame: (game) => ipcRenderer.invoke('launcher/launchGame', game),
  stopGame: (game) => ipcRenderer.invoke('launcher/stopGame', game),

  // Events
  onGameExited: (handler) => {
    ipcRenderer.removeAllListeners('launcher/gameExited');
    ipcRenderer.on('launcher/gameExited', (_evt, payload) => handler(payload));
  },

  // Updates & Releases
  getAppVersion: () => ipcRenderer.invoke('app/getVersion'),
  openExternal: (url) => ipcRenderer.invoke('system/openExternal', url),
  checkForUpdatesManual: () => ipcRenderer.invoke('app/checkForUpdatesManual'),
  installUpdate: () => ipcRenderer.invoke('update/install'),
  remindUpdateLater: () => ipcRenderer.invoke('update/remindLater'),
  getPendingUpdate: () => ipcRenderer.invoke('update/getPending'),
  quitAndInstallUpdate: () => ipcRenderer.invoke('update/quitAndInstall'),
  onUpdateAvailable: (handler) => {
    ipcRenderer.removeAllListeners('update/available');
    ipcRenderer.on('update/available', (_evt, payload) => handler(payload));
  },
  onUpdateProgress: (handler) => {
    ipcRenderer.removeAllListeners('update/progress');
    ipcRenderer.on('update/progress', (_evt, payload) => handler(payload));
  },
  onUpdateDownloaded: (handler) => {
    ipcRenderer.removeAllListeners('update/downloaded');
    ipcRenderer.on('update/downloaded', handler);
  },
  onUpdateError: (handler) => {
    ipcRenderer.removeAllListeners('update/error');
    ipcRenderer.on('update/error', (_evt, payload) => handler(payload));
  }
});
