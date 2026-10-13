'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const coreModuleSource = fs.readFileSync(path.join(root, 'score-core.js'), 'utf8');
const swSource = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');

function copy(value) {
  return JSON.parse(JSON.stringify(value));
}

function extractBetween(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  assert.notEqual(start, -1, 'start marker must exist: ' + startMarker);
  const end = source.indexOf(endMarker, start);
  assert.notEqual(end, -1, 'end marker must exist: ' + endMarker);
  return source.slice(start, end);
}

test('all inline JavaScript in index.html is syntactically valid', () => {
  const scripts = Array.from(html.matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi));
  assert.ok(scripts.length > 0, 'expected at least one inline script');
  scripts.forEach((match, i) => {
    new vm.Script(match[1], { filename: 'index.html:inline-script-' + (i + 1) });
  });
});

test('service worker JavaScript is syntactically valid', () => {
  new vm.Script(swSource, { filename: 'sw.js' });
});

test('extracted scoring module is syntactically valid', () => {
  new vm.Script(coreModuleSource, { filename: 'score-core.js' });
});

test('app shell loads the scoring module before its inline code', () => {
  const moduleTag = html.indexOf('<script src="score-core.js"></script>');
  const appScript = html.indexOf('<script>\n(function(){');
  assert.ok(moduleTag >= 0, 'index.html must load score-core.js');
  assert.ok(appScript > moduleTag, 'score module must load before app initialization');
  assert.match(html, /const APP_V='v36';/);
  assert.doesNotMatch(html, /\/\*CORE_START\*\//);
  assert.doesNotMatch(html, /\/\*CORE_END\*\//);
});

test('service worker pre-caches the extracted scoring module', () => {
  assert.match(swSource, /const CACHE='mici-score-v22';/);
  assert.match(swSource, /const CORE=\[[^\]]*'score-core\.js'/);
});


const platePersistenceSource = extractBetween(
  html,
  "const PLATE_KEY='mici:plate:v1';",
  '\nconst ui='
);

test('the assiette draft survives reload and rejects invalid saved items', () => {
  const values = new Map([['mici:plate:v1', JSON.stringify([
    { id: 'carotte-cuite', p: 1, g: 0 },
    { id: 'pain-blanc', p: 3, g: 15 },
    { id: 'unknown-food', p: 1, g: 0 },
    { id: 'carotte-cuite', p: 2, g: 0 },
    { id: 'pain-blanc', p: 9, g: 0 },
    { id: 'pain-blanc', p: 0, g: -5 }
  ])]]);
  const sandbox = {
    store: {},
    save() { values.set('mici:v2', JSON.stringify(sandbox.store)); },
    localStorage: {
      getItem(key) { return values.has(key) ? values.get(key) : null; },
      setItem(key, value) { values.set(key, value); }
    },
    byId(id) {
      return ['carotte-cuite', 'pain-blanc'].includes(id) ? { id } : null;
    }
  };
  vm.createContext(sandbox);
  new vm.Script(platePersistenceSource +
    '\nglobalThis.platePersistenceTest = { loadPlate, savePlate };'
  ).runInContext(sandbox);

  const plate = sandbox.platePersistenceTest.loadPlate();
  const expected = [
    { id: 'carotte-cuite', p: 1, g: 0 },
    { id: 'pain-blanc', p: 3, g: 15 }
  ];
  assert.deepEqual(copy(plate), expected);

  sandbox.ui = { plate };
  sandbox.platePersistenceTest.savePlate();
  assert.deepEqual(JSON.parse(values.get('mici:plate:v1')), expected);
  assert.deepEqual(copy(sandbox.store.plate), expected);
  sandbox.store = JSON.parse(values.get('mici:v2'));
  assert.deepEqual(copy(sandbox.platePersistenceTest.loadPlate()), expected);
  assert.match(html, /plate:loadPlate\(\)/);
  assert.match(html, /plate:Array\.isArray\(p\.plate\)\?p\.plate:null/);
  assert.match(html, /const txt=JSON\.stringify\(Object\.assign\(\{},store,\{acct:null,plate:undefined\}\)\)/);
  assert.match(html, /savePlate\(\);updateBar\(\)/);
  assert.match(html, /ui\.plate\[i\]\.g=.*?;savePlate\(\);render\(true\)/);
});


test('assiette persistence handles corrupt or unavailable browser storage', () => {
  const sandbox = {
    store: {},
    save() { throw new Error('quota exceeded'); },
    localStorage: {
      getItem() { throw new Error('storage disabled'); },
      setItem() { throw new Error('quota exceeded'); }
    },
    byId() { return null; }
  };
  vm.createContext(sandbox);
  new vm.Script(platePersistenceSource +
    '\nglobalThis.platePersistenceTest = { loadPlate, savePlate };'
  ).runInContext(sandbox);
  assert.deepEqual(copy(sandbox.platePersistenceTest.loadPlate()), []);
  sandbox.ui = { plate: [{ id: 'carotte-cuite', p: 1, g: 0 }] };
  assert.doesNotThrow(() => sandbox.platePersistenceTest.savePlate());
});

test('assiette storage is updated by edits and cleared by completed or destructive flows', () => {
  const clickSource = extractBetween(
    html,
    "document.addEventListener('click',e=>{",
    "\ndocument.getElementById('brand')"
  );
  assert.match(clickSource, /if\(a==='add'\)[\s\S]*?savePlate\(\);updateBar\(\)/);
  assert.match(clickSource, /else if\(a==='addDetail'\)[\s\S]*?savePlate\(\);render\(true\)/);
  assert.match(clickSource, /else if\(a==='clearBar'\)\{ui\.plate=\[\];savePlate\(\)/);
  assert.match(clickSource, /else if\(a==='pp'\)[\s\S]*?savePlate\(\);render\(true\)/);
  assert.match(clickSource, /else if\(a==='rm'\)[\s\S]*?savePlate\(\)/);
  assert.match(clickSource, /else if\(a==='clearPlate'\)\{ui\.plate=\[\];savePlate\(\)/);
  assert.match(clickSource, /else if\(a==='saveEntry'\)[\s\S]*?save\(\);ui\.plate=\[\];savePlate\(\)/);
  assert.match(clickSource, /else if\(a==='delFood'\)[\s\S]*?ui\.plate=ui\.plate\.filter[\s\S]*?savePlate\(\)/);
  assert.match(html, /store=restored;\s*ui\.plate=\[\];savePlate\(\)/);
  assert.match(html, /store=norm\(\{\}\)[\s\S]*?ui\.plate=\[\];savePlate\(\)/);
});

test('assiette persistence caps a corrupted oversized draft', () => {
  const saved = Array.from({ length: 105 }, (_, i) => ({
    id: 'food-' + i, p: 1, g: 0
  }));
  const values = new Map([['mici:plate:v1', JSON.stringify(saved)]]);
  const sandbox = {
    store: { plate: null },
    localStorage: { getItem(key) { return values.get(key) || null; } },
    byId(id) { return id.startsWith('food-') ? { id } : null; }
  };
  vm.createContext(sandbox);
  new vm.Script(platePersistenceSource +
    '\nglobalThis.loadPlateForTest = loadPlate;'
  ).runInContext(sandbox);
  assert.equal(sandbox.loadPlateForTest().length, 100);
});


test('assiette draft stays local and is excluded from sync and export payloads', () => {
  const dataHashLine = html.match(/const dataHash=.*?;\n/)[0];
  const snapLine = html.match(/const snap=.*?;\n/)[0];
  const sandbox = {
    store: {
      ep: 4, mt: 5, custom: [], entries: [], over: {}, sens: {},
      prof: 'poche', mods: {}, flags: {}, del: {},
      plate: [{ id: 'secret-draft-food', p: 1, g: 0 }]
    }
  };
  vm.createContext(sandbox);
  new vm.Script(dataHashLine + snapLine +
    '\nglobalThis.syncIsolation = { dataHash, snap };'
  ).runInContext(sandbox);
  const originalHash = sandbox.syncIsolation.dataHash();
  sandbox.store.plate.push({ id: 'another-draft-food', p: 2, g: 0 });
  assert.equal(sandbox.syncIsolation.dataHash(), originalHash);

  const remotePayload = sandbox.syncIsolation.snap();
  assert.equal(Object.hasOwn(remotePayload, 'plate'), false);
  assert.doesNotMatch(JSON.stringify(remotePayload), /secret-draft-food|another-draft-food/);

  const exportSandbox = {
    store: Object.assign({}, sandbox.store, { acct: { email: 'test@example.com' } })
  };
  vm.createContext(exportSandbox);
  new vm.Script(
    "const txt=JSON.stringify(Object.assign({},store,{acct:null,plate:undefined}));" +
    "\nglobalThis.exportedBackup = txt;"
  ).runInContext(exportSandbox);
  assert.doesNotMatch(exportSandbox.exportedBackup, /secret-draft-food|another-draft-food/);
  assert.match(html, /Object\.assign\(\{\},store,\{acct:null,plate:undefined\}\)/);
});

test('draft pruning removes custom foods that disappear during cloud sync', () => {
  const syncApplySource = extractBetween(
    html,
    'if(R&&sig(M)!==sig(L)){',
    '\n    if(!R||sig(M)!==sig(R))'
  );
  assert.match(syncApplySource, /store\.custom=M\.custom;[\s\S]*?savePlate\(\);[\s\S]*?_applying=false/);

  const values = new Map();
  const sandbox = {
    store: {
      custom: [{ id: 'custom-food', n: 'Test', c: 0, L: [0,0,0,0,0,0,0], b: 0 }],
      plate: null,
      entries: [], over: {}, sens: {}, prof: 'poche', mods: {}, flags: {}, del: {}
    },
    ui: { plate: [
      { id: 'custom-food', p: 1, g: 0 },
      { id: 'carotte-cuite', p: 1, g: 0 }
    ] },
    save() { values.set('mici:v2', JSON.stringify(sandbox.store)); },
    localStorage: { setItem(key, value) { values.set(key, value); } },
    byId(id) {
      if (id === 'carotte-cuite') return { id };
      return (sandbox.store.custom || []).find(f => f.id === id) || null;
    }
  };
  vm.createContext(sandbox);
  new vm.Script(platePersistenceSource +
    '\nglobalThis.reconcileDraft = savePlate;'
  ).runInContext(sandbox);
  sandbox.store.custom = [];
  sandbox.reconcileDraft();
  assert.deepEqual(copy(sandbox.ui.plate), [{ id: 'carotte-cuite', p: 1, g: 0 }]);
  assert.deepEqual(copy(sandbox.store.plate), [{ id: 'carotte-cuite', p: 1, g: 0 }]);
  assert.deepEqual(JSON.parse(values.get('mici:plate:v1')), [{ id: 'carotte-cuite', p: 1, g: 0 }]);
});


const backupExportSource = extractBetween(
  html,
  'function backupText(){',
  '\nconst app='
);

test('backup export has a manual fallback when clipboard access fails', () => {
  const sandbox = {
    store: {
      acct: { email: 'private@example.com' },
      plate: [{ id: 'draft-only-food', p: 1, g: 0 }],
      custom: [], entries: [{ id: 123, ts: 123, items: [], r: 8 }],
      over: {}, sens: {}, prof: 'poche', mods: {}, flags: {}, del: {}
    },
    ui: { exportText: '', msg: '' },
    render(keep) { this.renderKeep = keep; }
  };
  vm.createContext(sandbox);
  new vm.Script(backupExportSource +
    '\nglobalThis.backupExportTest = { backupText, showBackupCopyFallback };'
  ).runInContext(sandbox);

  const txt = sandbox.backupExportTest.backupText();
  const parsed = JSON.parse(txt);
  assert.equal(parsed.acct, null);
  assert.equal(Object.hasOwn(parsed, 'plate'), false);
  assert.doesNotMatch(txt, /draft-only-food|private@example.com/);

  sandbox.backupExportTest.showBackupCopyFallback(txt);
  assert.equal(sandbox.ui.exportText, txt);
  assert.match(sandbox.ui.msg, /Copie automatique impossible/);
  assert.equal(sandbox.renderKeep, true);
  assert.match(html, /id="backupOut" rows="8" readonly/);
  assert.match(html, /data-act="selectBackup"/);
  assert.match(html, /else if\(a==='selectBackup'\)[\s\S]*?el\.select\(\)/);
  assert.match(html, /const done=\(\)=>\{ui\.exportText='';ui\.msg='Sauvegarde copiée\.'/);
});

test('score formula and scale explanations stay consistent', () => {
  assert.match(coreModuleSource, /const K=9;/);
  assert.match(coreModuleSource, /function rawScore\(lv\)\{return 10\*Math\.exp\(-penalty\(lv\)\/K\)\}/);
  assert.match(html, /const APP_V='v36';/);
  assert.match(html, /Math\.min\(100,f\.L\[i\]\/4\*100\)/);
  assert.match(html, /Niveaux estimés de 0 à 4/);
  assert.match(html, /!arrNums\(f\.L,7,0,3\)/);
});

const validatorSource = extractBetween(
  html,
  'function validateBackup(p){',
  '\nconst hex2rgb'
);

function makeValidator() {
  const sandbox = {};
  vm.createContext(sandbox);
  new vm.Script(
    'const CATS = Array(14).fill("catégorie");\n' +
    'const RULES = {};\n' +
    'const FOODS = [{id:"carotte-cuite"}];\n' +
    validatorSource +
    '\nglobalThis.validateBackupForTest = validateBackup;'
  ).runInContext(sandbox);
  return sandbox.validateBackupForTest;
}

function validBackup() {
  return {
    custom: [{
      id: 'custom-a',
      n: 'Aliment de test',
      c: 0,
      L: [0, 0.5, 1, 0, 0, 0, 0],
      b: 0
    }],
    entries: [{
      id: 1720000000001,
      ts: 1720000000001,
      items: [{ id: 'carotte-cuite', n: 'Carotte cuite', p: 1, g: 0 }],
      r: 8,
      quest: false,
      jeun: false,
      note: 'Repas de test',
      L: [0, 0, 1, 0, 0, 0, 0],
      score: 8
    }],
    over: {},
    sens: { g: 1.1 },
    mods: { sten: false, crohn: false },
    flags: {},
    del: {},
    prof: 'poche',
    theme: 'micinuit',
    layout: 'liste',
    sort: 'cat',
    cbg: '#EDF1EE',
    cac: '#1F5C63',
    ver: 5,
    aurora: true,
    onb: true,
    ep: 1720000000001,
    mt: 1720000000001,
    acct: null
  };
}

test('valid backup is accepted and only supported fields are returned', () => {
  const input = validBackup();
  input.unexpectedPayload = '<script>alert(1)</script>';
  const result = makeValidator()(input);
  assert.equal(result.entries.length, 1);
  assert.equal(result.entries[0].r, 8);
  assert.equal(result.custom.length, 1);
  assert.equal(Object.hasOwn(result, 'unexpectedPayload'), false);
});

test('invalid backup values are rejected', async (t) => {
  const cases = [
    ['score above 10', (p) => { p.entries[0].r = 99; }],
    ['custom characteristic above 3', (p) => { p.custom[0].L[0] = 3.5; }],
    ['custom category out of range', (p) => { p.custom[0].c = 99; }],
    ['portion out of range', (p) => { p.entries[0].items[0].p = 99; }],
    ['note over 10000 characters', (p) => { p.entries[0].note = 'x'.repeat(10001); }],
    ['duplicate entry id', (p) => { p.entries.push(copy(p.entries[0])); }],
    ['wrong custom food name type', (p) => { p.custom[0].n = { bad: true }; }],
    ['non-integer timestamp', (p) => { p.entries[0].ts = 1720000000001.5; }],
    ['custom id collides with a built-in food', (p) => { p.custom[0].id = 'carotte-cuite'; }]
  ];
  for (const entry of cases) {
    await t.test(entry[0], () => {
      const input = validBackup();
      entry[1](input);
      assert.throws(() => makeValidator()(input));
    });
  }
});

test('legacy entries with a numeric string id and no timestamp stay importable', () => {
  const input = validBackup();
  input.entries[0].id = String(input.entries[0].id);
  input.entries[0].ts = undefined;
  const result = makeValidator()(input);
  assert.equal(result.entries[0].id, 1720000000001);
  assert.equal(result.entries[0].ts, 1720000000001);
});

test('failed import checks run before replacing store and report data preservation', () => {
  const start = html.indexOf("else if(a==='import'){");
  const end = html.indexOf("\n  else if(a==='reset')", start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const importer = html.slice(start, end);
  assert.ok(importer.indexOf('validateBackup(JSON.parse(raw))') < importer.indexOf('store=restored'));
  assert.match(importer, /Aucune donnée n’a été modifiée/);
  assert.match(importer, /raw\.length>8000000/);
});

const oauthSource = extractBetween(
  html,
  'function createOAuthState(){',
  '\nfunction getToken(interactive)'
);

function createOAuthHarness() {
  const values = new Map();
  const location = {
    hash: '',
    pathname: '/mici-score/',
    search: '',
    origin: 'https://johunn.github.io',
    assign() {}
  };
  const history = {
    state: null,
    replacedUrl: null,
    replaceState(_state, _title, url) { this.replacedUrl = url; }
  };
  const sandbox = {
    window: {
      crypto: {
        getRandomValues(bytes) {
          for (let i = 0; i < bytes.length; i++) bytes[i] = i;
          return bytes;
        }
      }
    },
    gs: { tok: null, exp: 0, st: '' },
    location,
    history,
    URLSearchParams,
    localStorage: {
      setItem(k, v) { values.set(k, v); },
      getItem(k) { return values.has(k) ? values.get(k) : null; },
      removeItem(k) { values.delete(k); }
    }
  };
  vm.createContext(sandbox);
  new vm.Script(oauthSource + '\nglobalThis.oauthForTest = { createOAuthState, acceptTokenResponse, readRedirect };').runInContext(sandbox);
  return { ...sandbox, values, location, history, helpers: sandbox.oauthForTest };
}

test('OAuth state is generated with a 32-byte hexadecimal value', () => {
  const h = createOAuthHarness();
  const state = h.helpers.createOAuthState();
  assert.match(state, /^[0-9a-f]{64}$/);
});

test('OAuth token responses are validated', async (t) => {
  const h = createOAuthHarness();
  assert.equal(h.helpers.acceptTokenResponse({
    access_token: 'test-token',
    token_type: 'Bearer',
    expires_in: '3600'
  }), 'test-token');

  const invalidResponses = [
    ['missing token', { token_type: 'Bearer', expires_in: 3600 }],
    ['wrong token type', { access_token: 'x', token_type: 'Basic', expires_in: 3600 }],
    ['zero expiry', { access_token: 'x', token_type: 'Bearer', expires_in: 0 }],
    ['excessive expiry', { access_token: 'x', token_type: 'Bearer', expires_in: 90000 }]
  ];

  for (const entry of invalidResponses) {
    await t.test(entry[0], () => {
      assert.throws(() => h.helpers.acceptTokenResponse(entry[1]));
    });
  }
});

test('OAuth redirect accepts matching state and clears token fragment', () => {
  const h = createOAuthHarness();
  const state = 'a'.repeat(64);
  h.values.set('mici:gstate', state);
  h.location.hash = '#access_token=good-token&token_type=Bearer&expires_in=3600&state=' + state;
  h.helpers.readRedirect();
  assert.equal(h.gs.tok, 'good-token');
  assert.equal(h.history.replacedUrl, '/mici-score/');
  assert.equal(h.values.has('mici:gstate'), false);
});

test('OAuth redirect rejects a state mismatch', () => {
  const h = createOAuthHarness();
  h.values.set('mici:gstate', 'a'.repeat(64));
  h.location.hash = '#access_token=bad-token&token_type=Bearer&expires_in=3600&state=' + 'b'.repeat(64);
  h.helpers.readRedirect();
  assert.equal(h.gs.tok, null);
  assert.match(h.gs.st, /invalide/);
});

const verifySource = extractBetween(
  html,
  'async function verifyGoogleAccount(tok){',
  '\nasync function findFile(tok)'
);

async function callAccountVerifier(email, verified) {
  const sandbox = {
    gapi: async () => ({
      json: async () => ({ email, email_verified: verified })
    }),
    store: { acct: { email: 'person@example.com' } }
  };
  vm.createContext(sandbox);
  new vm.Script(verifySource + '\nglobalThis.verifyGoogleAccountForTest = verifyGoogleAccount;').runInContext(sandbox);
  return sandbox.verifyGoogleAccountForTest('test-token');
}

test('Google account is checked before Drive access', async (t) => {
  assert.equal(await callAccountVerifier('PERSON@example.com', true), 'PERSON@example.com');
  await t.test('different account is rejected', async () => {
    await assert.rejects(() => callAccountVerifier('other@example.com', true), { message: 'account-mismatch' });
  });
  await t.test('unverified email is rejected', async () => {
    await assert.rejects(() => callAccountVerifier('person@example.com', false), { message: 'account-email' });
  });
  const accountCall = html.indexOf('const email=await verifyGoogleAccount(tok);');
  const driveRead = html.indexOf('let id=await findFile(tok),R=null;');
  const onlineDelete = html.indexOf('await verifyGoogleAccount(tok);\n    let id,n=0;');
  assert.ok(accountCall >= 0 && accountCall < driveRead);
  assert.ok(onlineDelete >= 0);
});

test('service worker only deletes MICI Score caches', async () => {
  const handlers = {};
  const deleted = [];
  const caches = {
    async keys() {
      return ['mici-score-v14', 'mici-score-v15', 'other-app-cache', 'workbox-cache'];
    },
    async delete(key) {
      deleted.push(key);
      return true;
    },
    async open() {
      return { async match() { return undefined; }, async put() {} };
    }
  };
  const self = {
    location: { origin: 'https://example.test' },
    clients: { async claim() {} },
    async skipWaiting() {},
    addEventListener(name, callback) { handlers[name] = callback; }
  };
  vm.runInNewContext(swSource, { self, caches, fetch: async () => { throw new Error('offline'); } });
  let activation;
  handlers.activate({ waitUntil(promise) { activation = promise; } });
  await activation;
  assert.deepEqual(deleted.sort(), ['mici-score-v14', 'mici-score-v15']);
});


function makeCoreHarness() {
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  new vm.Script(coreModuleSource, { filename: 'score-core.js' }).runInContext(sandbox);
  const core = sandbox.window.MICI_SCORE_CORE;
  assert.ok(core, 'score-core.js must expose the scoring API');
  return core;
}

function makeFood(id, L, extra = {}) {
  return Object.assign({
    id,
    n: id,
    c: 0,
    L,
    b: 0,
    ho: 0,
    u: 0
  }, extra);
}

test('score core loads and parses a large, valid food catalogue', () => {
  const core = makeCoreHarness();
  assert.ok(core.FOODS.length >= 450, 'unexpectedly few foods parsed');
  const rawRows = core.RAW.reduce((total, row) => total + row[1].length, 0);
  assert.equal(core.FOODS.length, rawRows,
    'one or more food catalogue rows were silently skipped during parsing');
  const ids = new Set();
  for (const food of core.FOODS) {
    assert.ok(food.id && typeof food.id === 'string');
    assert.ok(!ids.has(food.id), 'duplicate food id: ' + food.id);
    ids.add(food.id);
    assert.equal(food.L.length, 7, 'expected 7 features for ' + food.n);
    food.L.forEach((level, i) => {
      assert.ok(Number.isFinite(level) && level >= 0 && level <= 4,
        'invalid feature ' + i + ' for ' + food.n + ': ' + level);
    });
    assert.ok(Number.isFinite(food.b) && food.b >= 0 && food.b <= 2,
      'invalid thickener bonus for ' + food.n);
    assert.ok(Number.isFinite(food.ho) && food.ho >= 0);
    assert.ok(Number.isFinite(food.u) && food.u >= 0 && food.u <= 4);
    const calculated = core.single(food);
    assert.ok(Number.isFinite(calculated) && calculated >= 0 && calculated <= 10,
      'invalid single-food score for ' + food.n + ': ' + calculated);
    if (food.L.some(level => level > 3)) {
      assert.equal(food.rf, 'RC', 'only estimated composite foods may exceed level 3: ' + food.n);
    }
  }
});

test('neutral food scores 10 and a single feature follows the documented formula', () => {
  const core = makeCoreHarness();
  core.store.prof = 'general';
  core.store.sens = {};
  core.store.mods = {};
  core.store.over = {};

  const neutral = makeFood('neutral', [0, 0, 0, 0, 0, 0, 0]);
  assert.equal(core.single(neutral), 10);

  const fat = makeFood('one-fat-point', [1, 0, 0, 0, 0, 0, 0]);
  const expected = 10 * Math.exp(-(1.2) / 9);
  assert.ok(Math.abs(core.single(fat) - expected) < 1e-12);
});

test('portion factors and contextual adjustments are applied before the level cap', () => {
  const core = makeCoreHarness();
  const food = makeFood('portion-test', [2, 2, 0, 0, 0, 0, 0]);

  const trace = core.levels([{ f: food, p: 3 }], {});
  const small = core.levels([{ f: food, p: 0 }], {});
  const normal = core.levels([{ f: food, p: 1 }], {});
  const large = core.levels([{ f: food, p: 2 }], {});

  assert.ok(Math.abs(trace.L[0] - 0.6) < 1e-12);
  assert.ok(Math.abs(small.L[0] - 1.2) < 1e-12);
  assert.equal(normal.L[0], 2);
  assert.equal(large.L[0], 3);

  const context = core.levels([{ f: food, p: 1 }], { quest: true, jeun: true });
  assert.equal(context.L[0], 1.5);
  assert.ok(Math.abs(context.L[1] - 2.6) < 1e-12);
});

test('combined feature levels are capped at 4 and scores remain within 0–10', () => {
  const core = makeCoreHarness();
  core.store.prof = 'general';
  core.store.sens = {};
  core.store.mods = {};
  core.store.over = {};

  const food = makeFood('high-fat', [3, 0, 0, 0, 0, 0, 0]);
  const lv = core.levels([{ f: food, p: 2 }, { f: food, p: 2 }], {});
  assert.equal(lv.L[0], 4);
  const result = core.scoreOf([{ f: food, p: 2 }, { f: food, p: 2 }], {});
  assert.ok(Number.isFinite(result.score));
  assert.ok(result.score >= 0 && result.score <= 10);
});

test('pouch profile applies the documented lower oligosaccharide weight', () => {
  const core = makeCoreHarness();
  core.store.sens = {};
  core.store.mods = {};
  core.store.over = {};
  const oligoFood = makeFood('oligosaccharide-test', [0, 0, 0, 2, 0, 0, 0], { ho: 1 });

  core.store.prof = 'poche';
  const pouchPenalty = core.penalty(core.levels([{ f: oligoFood, p: 1 }], {}));
  core.store.prof = 'general';
  const generalPenalty = core.penalty(core.levels([{ f: oligoFood, p: 1 }], {}));

  assert.ok(Math.abs(pouchPenalty - 1.3) < 1e-12);
  assert.ok(Math.abs(generalPenalty - 2) < 1e-12);
  assert.ok(pouchPenalty < generalPenalty);
});

test('personal score correction replaces a food score and final results are clamped', () => {
  const core = makeCoreHarness();
  core.store.prof = 'general';
  core.store.sens = {};
  core.store.mods = {};
  const food = makeFood('override-test', [1, 0, 0, 0, 0, 0, 0]);

  core.store.over = { 'override-test': 8.5 };
  assert.ok(Math.abs(core.scoreOf([{ f: food, p: 1 }], {}).score - 8.5) < 1e-12);

  core.store.over = { 'override-test': 10 };
  assert.equal(core.scoreOf([{ f: food, p: 2 }], {}).score, 10);

  core.store.over = { 'override-test': 0 };
  assert.equal(core.scoreOf([{ f: food, p: 2 }], {}).score, 0);
});

test('feature weights and scoring constants are finite and non-negative', () => {
  const core = makeCoreHarness();
  assert.equal(core.FEATS.length, 7);
  assert.ok(core.FEATS.every(f => Number.isFinite(f.w) && f.w >= 0));
  assert.ok(Number.isFinite(core.K) && core.K > 0);
  assert.ok(Number.isFinite(core.BW) && core.BW >= 0);
  assert.ok(Number.isFinite(core.UW) && core.UW >= 0);
});


test('app shell required scoring API is exported by score-core.js', () => {
  const core = makeCoreHarness();
  const required = [
    'FEATS', 'BW', 'PF', 'CATS', 'RAW', 'FOODS', 'slug', 'store',
    'setStoreProvider', 'sensOf', 'PROF', 'UW', 'oMul', 'effL',
    'RULES', 'MODS', 'profMul', 'clamp', 'REFG_CAT', 'ORD',
    'REFG_NOM', 'refG', 'pfOf', 'grOf', 'levels', 'K', 'penalty',
    'rawScore', 'single', 'scoreOf'
  ];
  for (const name of required) {
    assert.ok(Object.hasOwn(core, name), 'missing score-core.js export: ' + name);
  }
});

test('scoring functions follow the app store provider when app state is replaced', () => {
  const core = makeCoreHarness();
  let appStore = Object.assign({}, core.store, {
    prof: 'general',
    sens: {},
    mods: {},
    over: {}
  });
  core.setStoreProvider(() => appStore);
  const food = makeFood('provider-test', [1, 0, 0, 0, 0, 0, 0]);
  const before = core.single(food);
  appStore = Object.assign({}, appStore, { sens: { g: 2 } });
  const after = core.single(food);
  assert.ok(after < before, 'the engine should use the currently active app store');
  assert.ok(Math.abs(after - 10 * Math.exp(-2.4 / 9)) < 1e-12);
});
