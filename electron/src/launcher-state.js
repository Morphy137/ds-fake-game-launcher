function makeGameKey(game) {
  if (!game || typeof game !== 'object') return '';
  const appId = String(game.appId ?? '');
  const exe = String(game.exe ?? '');
  const key = `${appId}::${exe}`;
  return key === '::' ? '' : key;
}

function isGameRunning(runningGames, game) {
  if (!runningGames || !game) return false;
  const key = makeGameKey(game);
  return Boolean(key && runningGames.has(key));
}

function syncRunningGameSet(runningGames, game, isRunning) {
  const next = new Set(runningGames || []);
  const key = makeGameKey(game);

  if (!key) return next;
  if (isRunning) {
    next.add(key);
  } else {
    next.delete(key);
  }

  return next;
}

function removeExitedGame(runningGames, game) {
  const next = new Set(runningGames || []);
  const key = makeGameKey(game);
  if (key) next.delete(key);
  return next;
}

function formatTimerRemaining(remainingMs) {
  const totalSeconds = Math.max(0, Math.floor((remainingMs || 0) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function calculateTimerProgress(startTime, durationMs, now = Date.now()) {
  const elapsed = Math.max(0, now - (startTime || now));
  const remaining = Math.max(0, (durationMs || 0) - elapsed);
  const isComplete = remaining <= 0;
  const percent = durationMs > 0 ? Math.min(100, Math.max(0, (elapsed / durationMs) * 100)) : 100;
  return { elapsed, remaining, isComplete, percent };
}

function formatTrayStatus(runningGamesCount, firstGameName) {
  const count = Math.max(0, Number(runningGamesCount) || 0);
  if (count <= 0) {
    return 'No games running';
  }
  if (count === 1) {
    return `Running: ${firstGameName || 'Game'}`;
  }
  return `Running: ${count} games`;
}

function getGameCoverCandidates(game) {
  if (!game || typeof game !== 'object') return [];
  const candidates = [];

  const steamId = String(game.steamAppId || '').trim();
  if (steamId) {
    // 1. High-res Steam library poster (600x900)
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

function resolveGameCoverUrl(game) {
  const candidates = getGameCoverCandidates(game);
  return candidates.length > 0 ? candidates[0] : null;
}

module.exports = {
  makeGameKey,
  isGameRunning,
  syncRunningGameSet,
  removeExitedGame,
  formatTimerRemaining,
  calculateTimerProgress,
  formatTrayStatus,
  getGameCoverCandidates,
  resolveGameCoverUrl
};
