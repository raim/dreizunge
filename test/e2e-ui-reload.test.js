// E2E: ui.json hot-reload (v45 minor). The server watches ui.json and reloads it
// non-destructively on external edits. boot() gives the server its own temp copy.
const { boot, get, sleep, assert } = require('./lib');

(async () => {
  const S = await boot();
  try {
    // Baseline: sentinel not present yet.
    let r = await get(S.sport, '/api/ui');
    assert(r.status === 200 && r.body && r.body.en, 'GET /api/ui failed');
    assert(r.body.en['_v45_reload_probe'] === undefined, 'probe key should not exist yet');
    const knownKeyCount = Object.keys(r.body.en).length;
    assert(knownKeyCount > 0, 'en block should be non-empty');

    // Edit the temp ui.json externally: add a sentinel key to the en block.
    const fs = require('fs');
    const ui = JSON.parse(fs.readFileSync(S.uiPath, 'utf8'));
    ui.en['_v45_reload_probe'] = 'hot reloaded';
    fs.writeFileSync(S.uiPath, JSON.stringify(ui, null, 2));

    // Wait past the 100ms watcher debounce.
    await sleep(600);
    r = await get(S.sport, '/api/ui');
    assert(r.body.en['_v45_reload_probe'] === 'hot reloaded', 'external edit was not hot-reloaded');
    console.log('  external edit hot-reloaded: OK');

    // Non-destructive: a broken (mid-write) file must NOT blank the strings.
    fs.writeFileSync(S.uiPath, '{ this is not valid json');
    await sleep(600);
    r = await get(S.sport, '/api/ui');
    assert(r.body && r.body.en, 'strings were blanked by a parse error (should be skipped)');
    assert(r.body.en['_v45_reload_probe'] === 'hot reloaded', 'previously-loaded strings should survive a bad write');
    console.log('  parse error skipped (strings preserved): OK');

    console.log('e2e-ui-reload: ALL PASSED');
  } finally {
    S.stop();
  }
})().catch(e => { console.error(e); process.exit(1); });
