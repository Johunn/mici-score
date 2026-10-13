'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
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

test('score formula and scale explanations stay consistent', () => {
  assert.match(html, /const K=9;/);
  assert.match(html, /function rawScore\(lv\)\{return 10\*Math\.exp\(-penalty\(lv\)\/K\)\}/);
  assert.match(html, /const APP_V='v30';/);
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
    ['non-integer timestamp', (p) => { p.entries[0].ts = 1720000000001.5; }]
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
