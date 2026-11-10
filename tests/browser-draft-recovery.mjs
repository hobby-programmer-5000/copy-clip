import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { pathToFileURL } from 'node:url';
import { connect } from './chromium.mjs';

const [browser, ui] = process.argv.slice(2);
if (!browser || !ui) throw new Error('Usage: node tests/browser-draft-recovery.mjs <Chromium or Edge exe> <built ui folder>');

const profile = await mkdtemp(join(tmpdir(), 'copyclip-browser-draft-'));
const pages = new Map();
for (const path of ['index.html', 'locales.js', 'vendor/highlight.min.js']) {
  pages.set('/' + path, await readFile(join(ui, path)));
}
const server = createServer((request, response) => {
  const { pathname } = new URL(request.url, 'http://localhost');
  const file = pages.get(pathname);
  if (!file) { response.writeHead(404).end(); return; }
  response.setHeader('Content-Type', pathname.endsWith('.js') ? 'text/javascript; charset=utf-8' : 'text/html; charset=utf-8');
  response.end(file);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const web = 'http://127.0.0.1:' + server.address().port + '/index.html';
const local = pathToFileURL(resolve(ui, 'index.html')).href;
const launcher = pathToFileURL(resolve(ui, 'editor.html')).href;

let child, exited, cdp;
async function startBrowser() {
  const portFile = join(profile, 'DevToolsActivePort');
  await rm(portFile, { force: true });
  child = spawn(resolve(browser), ['--headless', '--remote-debugging-port=0',
    '--user-data-dir=' + profile, '--no-first-run', '--disable-background-networking', 'about:blank'],
  { stdio: 'ignore', windowsHide: true });
  exited = once(child, 'exit');
  let port;
  for (let attempt = 0; attempt < 100 && !port; attempt++) {
    try { [port] = (await readFile(portFile, 'utf8')).split('\n'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (!port) await delay(100);
  }
  assert.ok(port, 'Browser debugger started');
  cdp = await connect(port);
  await cdp.send('Page.enable');
  await cdp.send('Network.enable');
  await cdp.send('Network.setBlockedURLs', { urls: ['*://fonts.googleapis.com/*', '*://fonts.gstatic.com/*'] });
}
async function closeBrowser() {
  if (!child) return;
  if (cdp) {
    await cdp.send('Browser.close').catch(() => {});
    cdp.close();
    cdp = null;
  } else if (child.exitCode === null && child.signalCode === null) {
    child.kill();
  }
  await exited;
  child = null;
}
async function open(url, editor = true, expectedUrl = url) {
  await cdp.send('Page.navigate', { url });
  const ready = 'location.href === ' + JSON.stringify(expectedUrl) +
    ' && document.querySelector("#toolbar")?.hidden === ' + !editor;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (await cdp.evaluate(ready)) return;
    await delay(50);
  }
  throw new Error('Editor did not load: ' + expectedUrl);
}
const click = id => cdp.evaluate('document.getElementById(' + JSON.stringify(id) + ').click()');
const value = id => cdp.evaluate('document.getElementById(' + JSON.stringify(id) + ').value');
async function typeInto(id, text) {
  await cdp.evaluate('(() => { const input = document.getElementById(' + JSON.stringify(id) +
    '); input.focus(); input.select(); })()');
  await cdp.send('Input.insertText', { text });
  assert.equal(await value(id), text);
}

try {
  for (const [label, entry, final] of [
    ['served editor', web + '?editor=1', web + '?editor=1'],
    ['bundled browser launcher', launcher, local + '?editor=1']
  ]) {
    await startBrowser();
    await open(entry, true, final);
    assert.equal(await value('card-title-input'), 'debounce.js');
    await typeInto('card-title-input', 'note.py');
    await cdp.evaluate('document.getElementById("card-title-input").blur()');
    await click('advanced');
    await click('direct-edit');
    await click('close-settings');
    const text = '첫 줄 📝\nsecond line';
    await typeInto('card-input', text);
    await click('edit');
    const pending = '적용하기 전 초안';
    await typeInto('input', pending);
    await closeBrowser();

    await startBrowser();
    await open(entry, true, final);
    assert.equal(await value('card-title-input'), 'note.py');
    assert.equal(await cdp.evaluate('document.getElementById("editor").open'), true);
    assert.equal(await value('input'), pending);
    await click('cancel');
    await open(final + '&reopen=1');
    assert.equal(await cdp.evaluate('document.getElementById("editor").open'), false);
    await click('edit');
    assert.equal(await value('input'), text);
    await cdp.evaluate('document.getElementById("input").value = ""');
    await click('save');
    await open(final + '&reopen=2');
    await click('edit');
    assert.equal(await value('input'), '');
    console.log('PASS ' + label + ': restore after browser restart, pending edit, Cancel and empty text');
    await closeBrowser();
  }

  await startBrowser();
  await open(web, false);
  assert.match(await cdp.evaluate('document.querySelector("#code").textContent'), /function debounce/);
  await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source:
    'Object.defineProperty(window, "localStorage", {get() { throw new DOMException("Blocked", "SecurityError"); }});' });
  await open(web + '?editor=1&blocked=1');
  assert.equal(await cdp.evaluate('document.getElementById("draft-status").hidden'), false);
  await click('edit');
  await typeInto('input', 'Still editable');
  await click('save');
  assert.match(await cdp.evaluate('document.querySelector("#code").textContent'), /Still editable/);
  assert.equal(await cdp.evaluate('document.getElementById("draft-status").hidden'), false);
  console.log('PASS default copy page and editing with browser storage blocked');
} finally {
  await closeBrowser();
  server.close();
}
