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
