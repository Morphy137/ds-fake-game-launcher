const test = require('node:test');
const assert = require('node:assert/strict');
const {
  makeGameKey,
  isGameRunning,
  syncRunningGameSet,
  removeExitedGame
} = require('../src/launcher-state');

test('makeGameKey produces correct composite key', () => {
  assert.equal(makeGameKey({ appId: '123', exe: 'game.exe' }), '123::game.exe');
  assert.equal(makeGameKey(null), '');
  assert.equal(makeGameKey({}), '');
});

test('syncRunningGameSet adds and removes keys cleanly', () => {
  const game = { appId: '456', exe: 'test.exe' };
  const set1 = syncRunningGameSet(new Set(), game, true);
  assert.equal(isGameRunning(set1, game), true);

  const set2 = syncRunningGameSet(set1, game, false);
  assert.equal(isGameRunning(set2, game), false);
});

test('removeExitedGame removes game from set', () => {
  const game = { appId: '789', exe: 'dummy.exe' };
  const initial = new Set(['789::dummy.exe', 'other::app.exe']);
  const updated = removeExitedGame(initial, game);
  assert.equal(updated.has('789::dummy.exe'), false);
  assert.equal(updated.has('other::app.exe'), true);
});

test('executable name sanitization and formatting', () => {
  const sanitize = (raw) => {
    const clean = String(raw || '').trim().replace(/[<>:"|?*]/g, '_');
    if (!clean) return '';
    return clean.toLowerCase().endsWith('.exe') ? clean : `${clean}.exe`;
  };

  assert.equal(sanitize('MTFSSteam-Win64-Shipping.exe'), 'MTFSSteam-Win64-Shipping.exe');
  assert.equal(sanitize('MTFSSteam-Win64-Shipping'), 'MTFSSteam-Win64-Shipping.exe');
  assert.equal(sanitize('game:name?.exe'), 'game_name_.exe');
  assert.equal(sanitize(''), '');
});

test('formatTimerRemaining formats mm:ss properly', () => {
  const { formatTimerRemaining } = require('../src/launcher-state');
  assert.equal(formatTimerRemaining(15 * 60 * 1000), '15:00');
  assert.equal(formatTimerRemaining(14 * 60 * 1000 + 42 * 1000), '14:42');
  assert.equal(formatTimerRemaining(5 * 1000), '00:05');
  assert.equal(formatTimerRemaining(0), '00:00');
  assert.equal(formatTimerRemaining(-5000), '00:00');
});

test('calculateTimerProgress calculates progress, remaining, and completion', () => {
  const { calculateTimerProgress } = require('../src/launcher-state');
  const duration = 15 * 60 * 1000;
  const start = 1000000;

  const atStart = calculateTimerProgress(start, duration, start);
  assert.equal(atStart.elapsed, 0);
  assert.equal(atStart.remaining, duration);
  assert.equal(atStart.isComplete, false);
  assert.equal(atStart.percent, 0);

  const halfWay = calculateTimerProgress(start, duration, start + (duration / 2));
  assert.equal(halfWay.remaining, duration / 2);
  assert.equal(halfWay.isComplete, false);
  assert.equal(halfWay.percent, 50);

  const finished = calculateTimerProgress(start, duration, start + duration + 5000);
  assert.equal(finished.remaining, 0);
  assert.equal(finished.isComplete, true);
  assert.equal(finished.percent, 100);
});

test('formatTrayStatus handles single, multiple, and empty games', () => {
  const { formatTrayStatus } = require('../src/launcher-state');
  assert.equal(formatTrayStatus(0), 'No games running');
  assert.equal(formatTrayStatus(-1), 'No games running');
  assert.equal(formatTrayStatus(1, 'HELLDIVERS 2'), 'Running: HELLDIVERS 2');
  assert.equal(formatTrayStatus(1), 'Running: Game');
  assert.equal(formatTrayStatus(2), 'Running: 2 games');
  assert.equal(formatTrayStatus(5), 'Running: 5 games');
});

test('resolveGameCoverUrl resolves Steam, Discord Cover, Discord Icon, and null', () => {
  const { resolveGameCoverUrl, getGameCoverCandidates } = require('../src/launcher-state');

  // Steam App ID priority
  const steamGame = { appId: '123', name: 'Helldivers', steamAppId: '553850', coverImageHash: 'abc', iconHash: 'def' };
  assert.equal(resolveGameCoverUrl(steamGame), 'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/553850/library_600x900.jpg');

  // Candidates chain includes Steam poster, Steam header, Discord cover, and Discord icon
  const candidates = getGameCoverCandidates(steamGame);
  assert.equal(candidates.length, 4);
  assert.equal(candidates[0], 'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/553850/library_600x900.jpg');
  assert.equal(candidates[1], 'https://cdn.akamai.steamstatic.com/steam/apps/553850/header.jpg');
  assert.equal(candidates[2], 'https://cdn.discordapp.com/app-icons/123/abc.png?size=512');
  assert.equal(candidates[3], 'https://cdn.discordapp.com/app-icons/123/def.png?size=256');

  // Discord cover image
  const discordCoverGame = { appId: '356875221078245376', name: 'Overwatch', coverImageHash: '843a3b07639f068fdacf40b9c3808c46', iconHash: 'a60bb76ba4d4acafbd4cb9aad6e61739' };
  assert.equal(resolveGameCoverUrl(discordCoverGame), 'https://cdn.discordapp.com/app-icons/356875221078245376/843a3b07639f068fdacf40b9c3808c46.png?size=512');

  // Discord icon only
  const discordIconGame = { appId: '999', name: 'Game', iconHash: 'xyz' };
  assert.equal(resolveGameCoverUrl(discordIconGame), 'https://cdn.discordapp.com/app-icons/999/xyz.png?size=256');

  // Fallback null
  assert.equal(resolveGameCoverUrl({ appId: '999', name: 'NoArt' }), null);
  assert.equal(resolveGameCoverUrl(null), null);
  assert.deepEqual(getGameCoverCandidates(null), []);
});
