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
const recipesSource = fs.readFileSync(path.join(root, 'recipes.js'), 'utf8');

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
  assert.ok(html.includes("const APP_V='v6.2';"));
  assert.doesNotMatch(html, /\/\*CORE_START\*\//);
  assert.doesNotMatch(html, /\/\*CORE_END\*\//);
});


test('settings and journal note fields have accessible labels and focus support', () => {
  assert.ok(html.includes('<label for="cid">Identifiant client Google</label><input type="text" id="cid"'));
  assert.ok(/<label for="enote">Note personnelle<\/label><textarea id="enote"/.test(html));
  assert.ok(html.includes(':focus-visible{outline:3px solid var(--accent);outline-offset:2px}'));
  assert.ok(html.includes('<nav class="tabs" aria-label="Navigation principale">'));
  assert.ok(html.includes('@media (prefers-reduced-motion:no-preference)'));
});

test('offline shell caches the app engine and local fonts without intercepting external origins', () => {
  assert.ok(swSource.includes("'index.html','score-core.js'"));
  assert.ok(swSource.includes("'fonts/bricolage-grotesque-latin-opsz-normal.woff2'"));
  assert.ok(swSource.includes("'fonts/figtree-latin-wght-normal.woff2'"));
  assert.ok(swSource.includes("'fonts/montserrat-latin-wght-normal.woff2'"));
  assert.ok(swSource.includes("if(new URL(r.url).origin!==self.location.origin)return;"));
  assert.ok(swSource.includes(".catch(()=>caches.open(CACHE).then(c=>c.match(r)))"));
});

test('service worker pre-caches the extracted scoring module and uses the current cache', () => {
  assert.match(swSource, /const CACHE='mici-score-v59';/);
  assert.match(swSource, /const CORE=\[[^\]]*'score-core\.js'/);
});


const saveSource = extractBetween(html, 'function save(){', '\nconst snap=');

test('local save reports storage failure without advancing the sync baseline', () => {
  function harness(failWrite) {
    const saved = new Map();
    const sandbox = {
      KEY: 'mici:v2',
      store: { entries: [{ id: 1 }], custom: [], over: {}, sens: {}, prof: 'poche', mods: {}, flags: {}, del: {}, mt: 1 },
      _h: 'previous-hash',
      _applying: false,
      syncCount: 0,
      dataHash() { return JSON.stringify([sandbox.store.entries]); },
      schedSync() { sandbox.syncCount++; },
      localStorage: {
        setItem(key, value) {
          if (failWrite) throw new Error('quota exceeded');
          saved.set(key, value);
        }
      }
    };
    vm.createContext(sandbox);
    new vm.Script(saveSource + '\nglobalThis.saveForTest = save;').runInContext(sandbox);
    return { sandbox, saved };
  }

  const failed = harness(true);
  assert.equal(failed.sandbox.saveForTest(), false);
  assert.equal(failed.sandbox._h, 'previous-hash');
  assert.equal(failed.sandbox.syncCount, 0);
  assert.equal(failed.saved.has('mici:v2'), false);

  const succeeded = harness(false);
  assert.equal(succeeded.sandbox.saveForTest(), true);
  assert.equal(succeeded.saved.has('mici:v2'), true);
  assert.notEqual(succeeded.sandbox._h, 'previous-hash');
  assert.equal(succeeded.sandbox.syncCount, 1);
  assert.ok(Number.isFinite(succeeded.sandbox.store.mt));
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
  assert.match(html, /function backupText\(\)[\s\S]*?plate:undefined/);
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
  assert.match(html, /store=restored;\s*ui\.plate=\[\];store\.plate=\[\]/);
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
  let renderedKeep;
  const sandbox = {
    store: {
      acct: { email: 'private@example.com' },
      plate: [{ id: 'draft-only-food', p: 1, g: 0 }],
      custom: [], entries: [{ id: 123, ts: 123, items: [], r: 8 }],
      over: {}, sens: {}, prof: 'poche', mods: {}, flags: {}, del: {}
    },
    ui: { exportText: '', msg: '' },
    render(keep) { renderedKeep = keep; }
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
  assert.equal(renderedKeep, true);
  assert.match(html, /id="backupOut" rows="8" readonly/);
  assert.match(html, /data-act="selectBackup"/);
  assert.match(html, /else if\(a==='selectBackup'\)[\s\S]*?el\.select\(\)/);
  assert.match(html, /const done=\(\)=>\{ui\.exportText='';ui\.msg='Sauvegarde copiée\.'/);
});

test('backup import discards unknown journal fields', () => {
  const backup = validBackup();
  backup.entries[0].obsoleteContext = true;
  const parsed = makeValidator()(backup);
  assert.equal(parsed.entries[0].r, 8);
  assert.equal(Object.hasOwn(parsed.entries[0], 'obsoleteContext'), false);
});

test('score formula and scale explanations stay consistent', () => {
  assert.match(coreModuleSource, /const K=9;/);
  assert.match(coreModuleSource, /function rawScore\(lv\)\{return 10\*Math\.exp\(-penalty\(lv\)\/K\)\}/);
  assert.ok(html.includes("const APP_V='v6.2';"));
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

test('journal entry migration keeps recognized fields and drops obsolete fields', () => {
  const source = extractBetween(
    html,
    "const JOURNAL_FIELDS=",
    "\nfunction norm(p){"
  );
  const sandbox = {};
  vm.createContext(sandbox);
  new vm.Script(source + "\nglobalThis.cleanEntriesForTest=cleanJournalEntries;").runInContext(sandbox);
  const entries = sandbox.cleanEntriesForTest([{
    id: 123,
    ts: 123,
    items: [],
    r: 8,
    jeun: false,
    note: "",
    obsoleteContext: true
  }]);
  assert.equal(entries[0].r, 8);
  assert.equal(entries[0].jeun, false);
  assert.equal(Object.hasOwn(entries[0], 'obsoleteContext'), false);
});

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

test('failed import preserves pasted text and leaves existing data untouched', () => {
  const importer = extractBetween(
    html,
    "else if(a==='import'){",
    "\n  else if(a==='reset')"
  ).replace("else if(a==='import'){", "if(a==='import'){");
  const input = { value: '{not-json' };
  const status = { textContent: '', style: { display: 'none' } };
  const initialStore = {
    acct: { email: 'keep@example.com' },
    entries: [{ id: 123, r: 8 }],
    custom: [{ id: 'custom-a' }]
  };
  const initialSnapshot = copy(initialStore);
  const sandbox = {
    a: 'import',
    document: {
      getElementById(id) {
        if (id === 'imp') return input;
        if (id === 'profileStatus') return status;
        return null;
      }
    },
    store: initialStore,
    ui: { msg: '', plate: [{ id: 'draft', p: 1, g: 0 }], exportText: 'backup', view: 'profile', editId: 7 },
    norm(value) { return value; },
    validateBackup() { throw new Error('invalid-backup'); },
    savePlate() { throw new Error('must not clear draft on failed import'); },
    save() { throw new Error('must not save on failed import'); },
    applyTheme() { throw new Error('must not apply restored theme on failed import'); },
    render() { throw new Error('must not rebuild the screen on failed import'); }
  };
  vm.createContext(sandbox);
  new vm.Script("(function(){\n" + importer + "\n}).call(globalThis);").runInContext(sandbox);

  assert.equal(input.value, '{not-json');
  assert.deepEqual(copy(sandbox.store), initialSnapshot);
  assert.deepEqual(copy(sandbox.ui.plate), [{ id: 'draft', p: 1, g: 0 }]);
  assert.equal(sandbox.ui.exportText, 'backup');
  assert.match(status.textContent, /Aucune donnée n’a été modifiée/);
  assert.equal(status.style.display, 'block');
  assert.match(html, /id="profileStatus"/);
});



test('restore storage failure keeps the previous data and draft unchanged', () => {
  const importer = extractBetween(
    html,
    "else if(a==='import'){",
    "\n  else if(a==='reset')"
  ).replace("else if(a==='import'){", "if(a==='import'){");
  const input = { value: JSON.stringify(validBackup()) };
  const status = { textContent: '', style: { display: 'none' } };
  const initialStore = {
    acct: { email: 'keep@example.com' }, entries: [{ id: 1, r: 2 }],
    custom: [{ id: 'old-custom' }], plate: [{ id: 'old-draft' }]
  };
  const snapshot = copy(initialStore);
  const sandbox = {
    a: 'import',
    document: { getElementById(id) {
      if (id === 'imp') return input;
      if (id === 'profileStatus') return status;
      return null;
    }},
    store: initialStore,
    ui: { msg: '', plate: [{ id: 'old-draft', p: 2, g: 0 }], exportText: 'fallback', view: 'profile', editId: 4 },
    norm(value) { return value; },
    validateBackup: makeValidator(),
    save() { return false; },
    applyTheme() { throw new Error('theme must not change if restore cannot be saved'); },
    render() { throw new Error('screen must not rebuild if restore cannot be saved'); }
  };
  vm.createContext(sandbox);
  new vm.Script("(function(){\n" + importer + "\n}).call(globalThis);").runInContext(sandbox);

  assert.deepEqual(copy(sandbox.store), snapshot);
  assert.deepEqual(copy(sandbox.ui.plate), [{ id: 'old-draft', p: 2, g: 0 }]);
  assert.equal(sandbox.ui.exportText, 'fallback');
  assert.equal(input.value, JSON.stringify(validBackup()));
  assert.match(status.textContent, /Impossible d’enregistrer la sauvegarde/);
  assert.match(status.textContent, /Aucune donnée n’a été modifiée/);
  assert.equal(status.style.display, 'block');
});

test('successful import replaces data, preserves the current account, and clears local draft state', () => {
  const importer = extractBetween(
    html,
    "else if(a==='import'){",
    "\n  else if(a==='reset')"
  ).replace("else if(a==='import'){", "if(a==='import'){");
  const input = { value: JSON.stringify(validBackup()) };
  const initialStore = {
    acct: { email: 'current@example.com' },
    entries: [{ id: 1, r: 2 }],
    custom: [{ id: 'old-custom' }],
    plate: [{ id: 'old-draft' }]
  };
  const sandbox = {
    a: 'import',
    document: { getElementById(id) { return id === 'imp' ? input : null; } },
    store: initialStore,
    ui: {
      msg: '', plate: [{ id: 'old-draft', p: 1, g: 0 }],
      exportText: 'old-fallback', view: 'profile', editId: 123
    },
    norm(value) { return value; },
    validateBackup: makeValidator(),
    PLATE_KEY: 'mici:plate:v1',
    localStorage: { values: new Map(), setItem(key, value) { this.values.set(key, value); } },
    saveCount: 0,
    persistedSnapshot: null,
    save() { sandbox.saveCount++; sandbox.persistedSnapshot = copy(sandbox.store); return true; },
    applyTheme() { sandbox.themeApplied = true; },
    render(keep) { sandbox.renderCount = (sandbox.renderCount || 0) + 1; sandbox.renderKeep = keep; }
  };
  vm.createContext(sandbox);
  new vm.Script("(function(){\n" + importer + "\n}).call(globalThis);").runInContext(sandbox);

  assert.equal(sandbox.store.acct.email, 'current@example.com');
  assert.equal(sandbox.store.entries.length, 1);
  assert.equal(sandbox.store.entries[0].r, 8);
  assert.equal(sandbox.store.custom[0].id, 'custom-a');
  assert.deepEqual(copy(sandbox.store.plate), []);
  assert.deepEqual(copy(sandbox.ui.plate), []);
  assert.equal(sandbox.ui.exportText, '');
  assert.equal(sandbox.ui.view, 'list');
  assert.equal(sandbox.ui.editId, null);
  assert.match(sandbox.ui.msg, /Sauvegarde restaurée/);
  assert.equal(sandbox.saveCount, 1);
  assert.deepEqual(copy(sandbox.persistedSnapshot.plate), []);
  assert.equal(sandbox.localStorage.values.get('mici:plate:v1'), '[]');
  assert.equal(sandbox.themeApplied, true);
  assert.equal(sandbox.renderCount, 1);
  assert.equal(sandbox.renderKeep, true);
  assert.ok(Number.isFinite(sandbox.store.ep));
  assert.ok(Number.isFinite(sandbox.store.mt));
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


const disconnectSource = extractBetween(
  html,
  'function gDisconnect(){',
  '\nasync function gDeleteOnline()'
);


const getTokenSource = extractBetween(
  html,
  'function getToken(interactive){',
  '\nasync function gapi'
);

test('late Google token responses cannot restore a token after disconnect', async () => {
  let client;
  const sandbox = {
    gs: { tok: null, exp: 0, client: null, session: 4 },
    store: { acct: { email: 'person@example.com' } },
    isStandalone() { return false; },
    loadGIS() { return Promise.resolve(); },
    cid() { return 'test-client'; },
    G_SCOPE: 'openid email',
    google: { accounts: { oauth2: {
      initTokenClient() {
        client = {
          callback: null,
          error_callback: null,
          requestAccessToken() {}
        };
        return client;
      }
    }}},
    acceptTokenResponse(response) {
      sandbox.gs.tok = response.access_token;
      sandbox.gs.exp = Date.now() + Number(response.expires_in) * 1000;
      return response.access_token;
    }
  };
  vm.createContext(sandbox);
  new vm.Script(getTokenSource + '\nglobalThis.getTokenForTest = getToken;').runInContext(sandbox);

  const pending = sandbox.getTokenForTest(false);
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(typeof client.callback, 'function');

  sandbox.gs.session++;
  sandbox.store.acct = null;
  sandbox.gs.tok = null;
  client.callback({ access_token: 'late-token', token_type: 'Bearer', expires_in: 3600 });

  await assert.rejects(pending, { message: 'cancelled' });
  assert.equal(sandbox.gs.tok, null);
  assert.equal(sandbox.store.acct, null);
});


test('disconnect invalidates a sync session and clears its scheduled timer', () => {
  const cleared = [];
  const sandbox = {
    gs: { tok: 'access-token', exp: 500, session: 7, timer: 123, again: true, st: 'Synchronisation…' },
    ui: { gmenu: true, msg: '' },
    store: { acct: { email: 'person@example.com' } },
    window: {},
    clearTimeout(handle) { cleared.push(handle); },
    save() { sandbox.saved = true; return true; },
    render(keep) { sandbox.renderKeep = keep; }
  };
  vm.createContext(sandbox);
  new vm.Script(disconnectSource + '\nglobalThis.disconnectForTest = gDisconnect;').runInContext(sandbox);
  sandbox.disconnectForTest();

  assert.equal(sandbox.gs.session, 8);
  assert.equal(sandbox.gs.timer, null);
  assert.equal(sandbox.gs.again, false);
  assert.equal(sandbox.gs.tok, null);
  assert.equal(sandbox.gs.exp, 0);
  assert.equal(sandbox.store.acct, null);
  assert.deepEqual(cleared, [123]);
  assert.equal(sandbox.saved, true);
  assert.equal(sandbox.renderKeep, true);
});

const syncSource = extractBetween(
  html,
  'async function syncNow(interactive){',
  '\nfunction schedSync(){'
);


test('disconnect warns when local storage cannot persist the account choice', () => {
  const source = extractBetween(
    html,
    'function gDisconnect(){',
    '\nasync function gDeleteOnline()'
  );
  const sandbox = {
    gs: { tok: null, exp: 0, session: 2, timer: null, again: false, st: '' },
    ui: { gmenu: false, msg: '' },
    store: { acct: { email: 'person@example.com' } },
    window: {},
    save() { return false; },
    render() {}
  };
  vm.createContext(sandbox);
  new vm.Script(source + '\nglobalThis.disconnectForTest = gDisconnect;').runInContext(sandbox);
  sandbox.disconnectForTest();
  assert.equal(sandbox.store.acct, null);
  assert.equal(sandbox.gs.session, 3);
  assert.match(sandbox.ui.msg, /n’a pas pu enregistrer ce choix/);
  assert.match(sandbox.ui.msg, /retire l’accès à MICI Score dans ton compte Google/);
});


test('an in-flight sync stops after the user disconnects', async () => {
  let resolveToken;
  let verificationCalls = 0;
  const pendingToken = new Promise(resolve => { resolveToken = resolve; });
  const sandbox = {
    cid() { return 'client-id'; },
    navigator: { onLine: true },
    gs: { tok: null, exp: 0, busy: false, again: false, st: '', timer: null, last: 0, session: 3 },
    store: { acct: { email: 'person@example.com' } },
    ui: { tab: 'calc', msg: '' },
    setSt() {},
    getToken() { return pendingToken; },
    async verifyGoogleAccount() { verificationCalls++; return 'person@example.com'; },
    async findFile() { throw new Error('should not read Drive after disconnect'); },
    refreshGbar() {},
    render() { throw new Error('no user message expected'); }
  };
  vm.createContext(sandbox);
  new vm.Script(syncSource + '\nglobalThis.syncForTest = syncNow;').runInContext(sandbox);

  const pendingSync = sandbox.syncForTest(false);
  assert.equal(sandbox.gs.busy, true);
  sandbox.gs.session++;
  sandbox.gs.tok = null;
  sandbox.store.acct = null;
  resolveToken('late-token');
  await pendingSync;

  assert.equal(verificationCalls, 0);
  assert.equal(sandbox.store.acct, null);
  assert.equal(sandbox.gs.busy, false);
});

test('online deletion refuses to overlap another Google operation', async () => {
  const deleteSource = extractBetween(
    html,
    'async function gDeleteOnline(){',
    '\nfunction statusText(){'
  );
  const sandbox = {
    gs: { busy: true, st: 'Synchronisation…', again: false, timer: null, session: 1 },
    ui: { msg: '' },
    render(keep) { sandbox.renderKeep = keep; },
    getToken() { throw new Error('must not request token during another Google operation'); }
  };
  vm.createContext(sandbox);
  new vm.Script(deleteSource + '\nglobalThis.deleteOnlineForTest = gDeleteOnline;').runInContext(sandbox);
  await sandbox.deleteOnlineForTest();
  assert.match(sandbox.gs.st, /opération Google est déjà en cours/);
  assert.equal(sandbox.renderKeep, true);
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
  const onlineDeleteStart = html.indexOf('async function gDeleteOnline(){');
  const onlineDeleteEnd = html.indexOf('\nfunction statusText(){', onlineDeleteStart);
  const onlineDelete = onlineDeleteStart >= 0 && onlineDeleteEnd > onlineDeleteStart
    ? html.slice(onlineDeleteStart, onlineDeleteEnd) : '';
  assert.ok(accountCall >= 0 && accountCall < driveRead);
  assert.ok(onlineDelete.includes('await verifyGoogleAccount(tok);'));
  assert.ok(onlineDelete.indexOf('await verifyGoogleAccount(tok);') < onlineDelete.indexOf("await gapi(tok,'/drive/v3/files/'+id,{method:'DELETE'})"));
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

test('portion factors and fasting adjustment are applied before the level cap', () => {
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

  const context = core.levels([{ f: food, p: 1 }], { jeun: true });
  assert.equal(context.L[0], normal.L[0], 'unrelated context must not change fat level');
  assert.ok(Math.abs(context.L[1] - 2.6) < 1e-12, 'fasting adjustment remains');
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


test('home dashboard prioritizes tasks and safely restores a previously logged meal', () => {
  assert.match(html, /function homeHTML\(\)/);
  assert.match(html, /data-act="startCompose"/);
  assert.match(html, /data-act="repeatEntry"/);
  assert.match(html, /const ui=\{tab:'calc',view:'home'/);
  assert.match(html, /else if\(a==='repeatEntry'\)[\s\S]*?filter\(x=>byId\(x\.id\)\)/);
  assert.ok(html.includes("const APP_V='v6.2';"));
});


test('v6 merges the personal dashboard with the fast task-oriented entry point', () => {
  assert.ok(html.includes('Moins de recherche.<br>Plus de repères.'));
  assert.match(html, /data-act="startCompose">＋ Composer un repas/);
  assert.match(html, /Comprendre mon historique/);
  assert.match(html, /Ressenti moyen · 7 jours/);
});

test('v5 uses a dedicated meal composer and personal-observation journal', () => {
  assert.match(html, /data-tab="calc"><span class="tab-icon"/);
  assert.match(html, /data-tab="compose"><span class="tab-icon"/);
  assert.match(html, /function homeHTML\(\)[\s\S]*?Ressenti moyen · 7 jours/);
  assert.match(html, /function calcHTML\(\)[\s\S]*?COMPOSITION · ÉTAPE 1/);
  assert.match(html, /data-act="journalRange"/);
  assert.match(html, /journalDays:30/);
  assert.match(html, /else if\(a==='journalRange'\)/);
  assert.match(html, /data-act="openProfile"/);
  assert.match(html, /data-act="openSources"/);
  assert.match(html, /mici:plate:v1/);
  assert.match(html, /function plateHTML\(\)[\s\S]*?Ton brouillon est conservé localement/);
});


test('v6 provides four task-oriented navigation items and direct settings access', () => {
  assert.match(html, /data-tab="calc"/);
  assert.match(html, /data-tab="compose"/);
  assert.match(html, /data-tab="journal"/);
  assert.match(html, /data-tab="catalogue"/);
  assert.match(html, /data-act="openProfile" aria-label="Paramètres et données"/);
  assert.match(html, /target==='catalogue'[\s\S]*?ui.view='list'/);
});


test('recipe catalogue loads locally and uses the existing scoring and plate flow', () => {
  assert.ok(html.includes('<script src="recipes.js"></script>'));
  assert.match(html, /function recipesHTML\(\)/);
  assert.match(html, /scoreOf\(scoreItems,ui\)/);
  assert.match(html, /data-act="addRecipe"/);
  assert.match(swSource, /mici-score-v59/);
  assert.match(swSource, /'recipes\.js'/);
  assert.match(html, /Ingrédients ajoutés\. Vérifie les quantités/);
});

test('food and recipe catalogs use matching one-row search, sort, category, and clear controls', () => {
  assert.match(html, /class="unified-controls food-controls"/);
  assert.match(html, /class="unified-controls recipe-unified-controls"/);
  assert.match(html, /id="qs"/);
  assert.match(html, /id="recipe-search"/);
  assert.match(html, /data-act="clearq"/);
  assert.match(html, /data-act="clearRecipeSearch"/);
  assert.match(html, /id="food-category"/);
  assert.match(html, /id="recipe-category"/);
  assert.match(html, /#app \.unified-controls\{display:grid!important;grid-template-columns:minmax\(0,1fr\) 142px 160px!important/);
  assert.match(html, /#app \.unified-search:focus-within\{border:2px solid var\(--accent\)!important;outline:none!important;box-shadow:none!important\}/);
  assert.match(swSource, /const CACHE='mici-score-v59';/);
});

test('recipe search and sort share one row, search focus has no halo, and score badges are redesigned', () => {
  assert.match(html, /#app \.recipe-controls\{display:grid!important;grid-template-columns:minmax\(0,1fr\) 132px!important/);
  assert.match(html, /#app \.recipe-controls \.field:nth-child\(3\)\{grid-column:2!important;grid-row:1!important/);
  assert.match(html, /#app \.searchbox input\[type=search\]:focus,#app \.searchbox input\[type=search\]:focus-visible\{border:2px solid var\(--accent\)!important;outline:none!important;outline-offset:0!important;box-shadow:none!important\}/);
  assert.match(html, /#app \.badge,#app \.exp-score\{font-family:var\(--f-display\)!important;font-size:24px!important;font-weight:900!important/);
  assert.match(html, /#app \.recipe-score-pill\{min-width:60px!important;min-height:48px!important;padding:7px 12px!important;font-size:25px!important;font-weight:900!important/);
  assert.match(swSource, /const CACHE='mici-score-v59';/);
});

test('reopening a journal meal restores its saved feeling and notes for editing', () => {
  assert.match(html, /ui\.mealEditId=e\.id[\s\S]*?ui\.ress=Number\.isFinite\(\+e\.r\)[\s\S]*?ui\.note=e\.note\|\|''/);
  assert.match(html, /data-act="repeatEntry"[\s\S]*?Reprendre et modifier/);
  assert.match(html, /data-act="cancelMealEdit"/);
});

test('saving an edited meal updates the existing journal entry instead of duplicating it', () => {
  assert.match(html, /if\(ui\.mealEditId\)\{const existing=store\.entries\.find\(x=>String\(x\.id\)===String\(ui\.mealEditId\)\)/);
  assert.match(html, /existing\.items=savedItems;existing\.r=ui\.ress;existing\.jeun=ui\.jeun;existing\.note=ui\.note\.trim\(\)/);
  assert.match(html, /else store\.entries\.push\(\{id:now,ts:now/);
  assert.match(html, /existing\.edited=now/);
});

test('last meals are promoted on the home screen and journal with full meal-edit actions', () => {
  const home = extractBetween(html, 'function homeHTML(){', 'function recipesHTML(){');
  const journal = extractBetween(html, 'function journalHTML(){', 'function learning()');
  assert.ok(home.indexOf('MÉMOIRE RÉCENTE') < home.indexOf('MON HISTORIQUE'));
  assert.ok(journal.indexOf('HISTORIQUE') < journal.indexOf('ÉVOLUTION'));
  assert.match(journal, /Reprendre et modifier/);
  assert.match(journal, /Corriger la note/);
  assert.match(html, /\.recent-meals\{border:1px solid var\(--line\);border-radius:16px/);
});


test('recipe catalogue contains at least 15 documented ideas with resolvable local ingredients', () => {
  const recipeSandbox = { window: {} };
  vm.createContext(recipeSandbox);
  new vm.Script(recipesSource, { filename: 'recipes.js' }).runInContext(recipeSandbox);
  const recipes = recipeSandbox.window.MICI_RECIPES;
  assert.ok(Array.isArray(recipes));
  assert.ok(recipes.length >= 15, 'recipe catalogue should contain more than four entries');
  assert.equal(new Set(recipes.map(r => r.id)).size, recipes.length, 'recipe IDs must be unique');
  assert.ok(recipes.every(r => r.title && r.category && r.summary && r.source.startsWith('https://')));
  assert.ok(html.includes('Recettes à tester selon ta tolérance'));
  assert.ok(html.includes('IDÉES DE REPAS · ${recipes.length} RECETTES'));
  assert.ok(html.includes('Source : <a href="${esc(r.source)}"'));
  assert.ok(html.includes('${esc(r.sourceLabel)} ↗</a>'));
  const coreSandbox = { window: {} };
  vm.createContext(coreSandbox);
  new vm.Script(coreModuleSource, { filename: 'score-core.js' }).runInContext(coreSandbox);
  const foods = coreSandbox.window.MICI_SCORE_CORE.FOODS;
  const norm = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  for (const recipe of recipes) {
    if (recipe.adaptationVerified === false && !recipe.scoreNote) {
      assert.equal(recipe.scoreDisabled, true, 'unverified adaptation without a partial-score note must stay disabled: ' + recipe.title);
      assert.equal(recipe.ingredients.length, 0, 'unverified adaptation without a partial-score note must not retain placeholder ingredients: ' + recipe.title);
      assert.equal(recipe.steps.length, 0, 'unverified adaptation without a partial-score note must not retain placeholder steps: ' + recipe.title);
      continue;
    }
    if (recipe.scoreDisabled) {
      assert.match(recipe.scoreNote || '', /Score désactivé/i, 'disabled recipe must explain why it has no score: ' + recipe.title);
      assert.ok(Array.isArray(recipe.unscoredIngredients) && recipe.unscoredIngredients.length > 0, 'disabled recipe must state what blocks scoring: ' + recipe.title);
      continue;
    }
    assert.ok(recipe.ingredients.length >= 1, 'scored recipe needs at least one ingredient: ' + recipe.title);
    if (!recipe.scoreNote) assert.ok(recipe.steps.length >= 2, 'verified recipe needs preparation steps: ' + recipe.title);
    for (const ingredient of recipe.ingredients) {
      const found = foods.some(food => ingredient.names.some(name =>
        norm(food.n) === norm(name) || norm(food.n).startsWith(norm(name) + ' ')
      ));
      assert.ok(found, 'unresolvable ingredient in ' + recipe.title + ': ' + ingredient.names[0]);
    }
  }
  const partialRecipes = recipes.filter(recipe => recipe.scoreNote);
  assert.ok(partialRecipes.filter(recipe => recipe.unscoredIngredients && recipe.unscoredIngredients.length).length >= 5, 'partial recipes must list excluded ingredients and amounts');
  const disabledRecipes = recipes.filter(recipe => recipe.scoreDisabled);
  assert.equal(disabledRecipes.length, 3, 'only the three recipes that cannot produce a meaningful single score should be disabled');
  assert.ok(disabledRecipes.every(recipe => /Score désactivé/i.test(recipe.scoreNote || '') && recipe.unscoredIngredients?.length), 'every disabled recipe must state the concrete blocker');
  assert.ok(recipes.filter(recipe => !recipe.scoreDisabled).every(recipe => recipe.ingredients.length > 0), 'every enabled recipe must have ingredients for its score');
  assert.ok(html.includes('Ingrédients non comptés dans le score'), 'excluded ingredients must be visible in recipe details');
  assert.ok(partialRecipes.length >= 5, 'partial-score recipes should explain excluded ingredients');
  const appleCakes = recipes.find(recipe => recipe.id === 'gateaux-pommes');
  assert.ok(appleCakes, 'apple cakes recipe must exist');
  assert.ok(appleCakes.ingredients.some(ingredient => ingredient.names.some(name => norm(name) === 'cannelle')), 'cinnamon must be included in the apple-cake score when listed as a scored ingredient');
  assert.ok(!appleCakes.unscoredIngredients.some(ingredient => norm(ingredient.name) === 'cannelle'), 'cinnamon must not also be listed among unscored apple-cake ingredients');
  assert.match(appleCakes.scoreNote, /pomme et cannelle sont comptées/i, 'apple-cake partial-score note must accurately identify its scored ingredients');
  assert.ok(html.includes('r.scoreNote?`<p class="notice">'), 'partial-score note must be visible');
  assert.ok(html.includes('${esc(r.scoreNote)}</p>'), 'partial-score note must render its text');
  assert.ok(html.includes('Ajouter les ingrédients comptés à mon assiette'), 'partial recipes must clarify what gets added to the plate');
});

test('recipes have a dedicated main-navigation entry and open the recipe catalogue', () => {
  assert.match(html, /<button data-tab="recipes"><span class="tab-icon" aria-hidden="true">▧<\/span><span>Recettes<\/span><\/button>/);
  assert.match(html, /if\(target==='recipes'\)\{ui\.tab='compose';ui\.view='recipes';ui\.recipeId=null;render\(\);return\}/);
  assert.match(html, /b\.dataset\.tab==='recipes'&&ui\.tab==='compose'&&ui\.view==='recipes'/);
  assert.match(html, /function recipesHTML\(\)/);
  assert.match(recipesSource, /"id":/);
});

test('catalog and recipe search/sort stay on one row and score numbers are large and bold', () => {
  assert.match(html, /#app \.catalog-tools\{display:grid!important;grid-template-columns:minmax\(0,1fr\) 132px!important/);
  assert.match(html, /#app \.catalog-tools \.catalog-sort\{grid-column:2!important;grid-row:1!important/);
  assert.match(html, /#app \.recipe-controls\{display:grid!important;grid-template-columns:minmax\(0,1fr\) 132px!important/);
  assert.match(html, /#app \.recipe-controls \.field:nth-child\(3\)\{grid-column:2!important;grid-row:1!important/);
  assert.match(html, /#app \.badge,#app \.exp-score\{font-family:var\(--f-display\)!important;font-size:24px!important;font-weight:900!important/);
  assert.match(html, /#app \.recipe-score-pill\{min-width:60px!important;min-height:48px!important;padding:7px 12px!important;font-size:25px!important;font-weight:900!important/);
  assert.match(swSource, /const CACHE='mici-score-v59';/);
});

test('recipe catalogue has unique IDs and titles and all ingredients resolve to local food entries', () => {
  const recipeSandbox = { window: {} };
  vm.createContext(recipeSandbox);
  new vm.Script(recipesSource, { filename: 'recipes.js:deduplication-test' }).runInContext(recipeSandbox);
  const recipes = recipeSandbox.window.MICI_RECIPES;
  assert.ok(recipes.length >= 25, 'expected an expanded recipe catalogue');
  assert.equal(new Set(recipes.map(r => r.id)).size, recipes.length, 'recipe IDs must be unique');
  const normalize = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  assert.equal(new Set(recipes.map(r => normalize(r.title))).size, recipes.length, 'recipe titles must be unique');
  const coreSandbox = { window: {} };
  vm.createContext(coreSandbox);
  new vm.Script(coreModuleSource, { filename: 'score-core.js:food-catalogue-test' }).runInContext(coreSandbox);
  const foods = coreSandbox.window.MICI_SCORE_CORE.FOODS;
  for (const recipe of recipes) {
    const scoreItems = [];
    for (const ingredient of recipe.ingredients) {
      const food = foods.find(food => ingredient.names.some(name => normalize(food.n) === normalize(name))) ||
        foods.find(food => ingredient.names.some(name => normalize(food.n).startsWith(normalize(name) + ' ')));
      assert.ok(food, recipe.title + ' ingredient must resolve: ' + ingredient.names[0]);
      scoreItems.push({ f: food, p: 1, g: ingredient.grams });
    }
    if (!recipe.scoreDisabled) {
      const score = coreSandbox.window.MICI_SCORE_CORE.scoreOf(scoreItems, {});
      assert.ok(Number.isFinite(score.score) && score.score >= 0 && score.score <= 10,
        recipe.title + ' must produce a finite MICI Score from its configured ingredients');
    }
  }
  assert.equal(recipes.length, 79, 'recipe catalogue coverage must remain explicit');
  assert.equal(recipes.filter(recipe => !recipe.scoreDisabled).length, 76, '76 recipes must produce scores from configured ingredients');
});

test('journal recipe entries show the calculated MICI Score as the primary badge and personal feeling separately', () => {
  assert.match(html, /cls\(e\.score!=null\?e\.score:e\.r\)/);
  assert.match(html, /fmt\(e\.score!=null\?e\.score:e\.r\)/);
  assert.match(html, /ressenti personnel '\+fmt\(e\.r\)\+'\/10/);
  assert.match(html, /La pastille affiche le score MICI calculé/);
  assert.match(html, /const r=scoreOf\(items,ui\)[\s\S]*?score:r\.score/);
});

test('les recettes à adaptation non validée sont scorables ou bloquées avec une raison explicite', () => {
  const recipeSandbox = { window: {} };
  vm.createContext(recipeSandbox);
  new vm.Script(recipesSource, { filename: 'recipes.js:partial-coverage-test' }).runInContext(recipeSandbox);
  const recipes = recipeSandbox.window.MICI_RECIPES;
  const pending = recipes.filter(recipe => recipe.adaptationVerified === false);
  assert.ok(pending.length >= 52, 'all currently pending source-backed adaptations must be covered');
  const disabled = pending.filter(recipe => recipe.scoreDisabled);
  assert.equal(disabled.length, 3, 'only the source-unverified salad and two multi-recipe cards should be blocked');
  for (const recipe of pending) {
    assert.ok(Array.isArray(recipe.ingredients) && recipe.ingredients.length > 0, recipe.id + ' must retain the known ingredients');
    assert.ok(recipe.scoreNote, recipe.id + ' must explain score coverage or the blocker');
    assert.ok(Array.isArray(recipe.unscoredIngredients), recipe.id + ' must expose an explicit exclusion list');
    if (recipe.scoreDisabled) {
      assert.match(recipe.scoreNote, /Score désactivé/i, recipe.id + ' must explain why scoring is disabled');
      assert.ok(recipe.unscoredIngredients.length > 0, recipe.id + ' must state the blocking reason');
    }
  }
  assert.equal(pending.length - disabled.length, 49, '49 of the 52 pending adaptations should have usable partial scores');
});

test('three source-backed recipes include their main scoreable ingredients and name exclusions precisely', () => {
  const recipeSandbox = { window: {} };
  vm.createContext(recipeSandbox);
  new vm.Script(recipesSource, { filename: 'recipes.js:source-ingredient-corrections' }).runInContext(recipeSandbox);
  const recipes = recipeSandbox.window.MICI_RECIPES;
  const get = id => recipes.find(recipe => recipe.id === id);
  const names = id => get(id).ingredients.map(ingredient => ingredient.names[0]);
  assert.equal(JSON.stringify(names('pates-fromage-legere')), JSON.stringify([
    'Pâtes blanches nature', 'Thon en boîte au naturel', 'Courgette cuite sans peau',
    'Lait demi-écrémé (verre 25 cl)', 'Fromage râpé'
  ]));
  assert.ok(get('pates-fromage-legere').unscoredIngredients.some(item => item.name === 'Maïzena'));
  assert.equal(JSON.stringify(names('pates-chicons-saumon')), JSON.stringify([
    'Pâtes blanches nature', 'Endive cuite', 'Saumon fumé', 'Beurre (fine couche)', 'Moutarde de Dijon'
  ]));
  assert.ok(get('pates-chicons-saumon').unscoredIngredients.some(item => item.name === 'Crème de soja light'));
  assert.ok(names('salade-poulet-curry').includes('Fromage blanc 0 %'));
  assert.ok(!names('salade-poulet-curry').includes('Mayonnaise allégée'));
  assert.ok(names('pates-saumon').includes('Saumon fumé'));
  assert.ok(get('pates-saumon').unscoredIngredients.some(item => item.name === 'Crème de soja légère'));
  assert.ok(names('nouilles-riz-legumes').includes('Poulet rôti du commerce'));
  assert.ok(names('nouilles-riz-legumes').includes('Vermicelles ou nouilles de riz'));
  assert.ok(!get('nouilles-riz-legumes').unscoredIngredients.some(item => item.name === 'Nouilles de riz'));
});

