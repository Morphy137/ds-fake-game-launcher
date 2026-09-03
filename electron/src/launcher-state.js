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

module.exports = {
  makeGameKey,
  isGameRunning,
  syncRunningGameSet,
  removeExitedGame,
  formatTimerRemaining,
  calculateTimerProgress
};
