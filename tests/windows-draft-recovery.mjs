import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { connect } from './chromium.mjs';

const [executable] = process.argv.slice(2);
if (!executable) throw new Error('Usage: node tests/windows-draft-recovery.mjs <CopyClip.exe>');

const profile = await mkdtemp(join(tmpdir(), 'copyclip-draft-'));
const draftPath = join(profile, 'copyclip-draft.json');
const probe = createServer();
await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
const { port } = probe.address();
await new Promise(resolve => probe.close(resolve));

let child, exited, cdp;
async function until(check, description) {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (await check()) return;
    await delay(50);
  }
  throw new Error('Timed out: ' + description);
}
async function launch() {
  child = spawn(resolve(executable), [], {
    windowsHide: true,
    stdio: 'ignore',
    env: {
      ...process.env,
      WEBVIEW2_USER_DATA_FOLDER: profile,
      WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: '--remote-debugging-port=' + port
    }
  });
  exited = once(child, 'exit');
  cdp = await connect(port, target => target.url === 'https://copyclip.example/index.html');
  await until(() => cdp.evaluate('document.querySelector("#toolbar")?.hidden === false'), 'app startup');
}
async function forceQuit() {
  cdp?.close();
  cdp = null;
  if (!child) return;
  if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
  await exited;
  child = null;
  await until(async () => {
    try {
      const response = await fetch('http://127.0.0.1:' + port + '/json/list', { signal: AbortSignal.timeout(500) });
      return (await response.json()).length === 0;
    } catch {
      return true;
    }
  }, 'old WebView to exit');
}
const click = id => cdp.evaluate('document.getElementById(' + JSON.stringify(id) + ').click()');
const value = id => cdp.evaluate('document.getElementById(' + JSON.stringify(id) + ').value');
async function typeInto(id, text) {
  await cdp.evaluate('(() => { const input = document.getElementById(' + JSON.stringify(id) +
    '); input.focus(); input.select(); })()');
  await cdp.send('Input.insertText', { text });
  assert.equal(await value(id), text);
}
async function saved(expected) {
  await until(async () => {
    try {
      const draft = JSON.parse(await readFile(draftPath, 'utf8'));
      return draft.title === expected.title && draft.text === expected.text && draft.pendingText === expected.pendingText;
    } catch (error) {
      if (error.code === 'ENOENT') return false;
      throw error;
    }
  }, 'draft file to contain the latest snapshot');
}

try {
  await launch();
  assert.match(await cdp.evaluate('document.querySelector("#code").textContent'), /function debounce/);
  await assert.rejects(readFile(draftPath), { code: 'ENOENT' });

  const normalText = '일반 창에서 작성한 내용';
  await click('advanced');
  await click('direct-edit');
  await click('close-settings');
  await typeInto('card-input', normalText);
  await saved({ title: 'debounce.js', text: normalText, pendingText: null });
  await forceQuit();

  await launch();
  await click('edit');
  assert.equal(await value('input'), normalText);
  await click('cancel');

  const title = 'note.py';
  const text = Array.from({ length: 12 }, (_, index) => '줄 ' + (index + 1) + ' 📝').join('\n');
  await click('advanced');
  await click('open-widget');
  await until(() => cdp.evaluate('document.documentElement.classList.contains("widget")'), 'widget mode');
  await typeInto('card-title-input', title);
  await cdp.evaluate('document.getElementById("card-title-input").blur()');
  await typeInto('card-input', text);
  await saved({ title, text, pendingText: null });
  await forceQuit();

  await launch();
  assert.equal(await value('card-title-input'), title);
  await click('edit');
  assert.equal(await value('input'), text);
  const pendingText = '편집 창의 미적용 초안\nsecond line';
  await typeInto('input', pendingText);
  await saved({ title, text, pendingText });
  await forceQuit();

  await launch();
  assert.equal(await cdp.evaluate('document.getElementById("editor").open'), true);
  assert.equal(await value('input'), pendingText);
  await click('cancel');
  await saved({ title, text, pendingText: null });
  await click('edit');
  assert.equal(await value('input'), text);
  await cdp.evaluate('document.getElementById("input").value = ""');
  await click('save');
  await saved({ title, text: '', pendingText: null });
  await forceQuit();

  await launch();
  assert.equal(await value('card-title-input'), title);
  assert.equal(await cdp.evaluate('document.getElementById("editor").open'), false);
  await click('edit');
  assert.equal(await value('input'), '');
  await cdp.evaluate(`window.draftSaveReplies = [];
    window.chrome.webview.addEventListener('message', event => {
      if (typeof event.data?.saved === 'boolean') window.draftSaveReplies.push(event.data.saved);
    });`);
  await click('sample');
  assert.match(await value('input'), /function debounce/);
  await click('cancel');
  await until(() => cdp.evaluate('draftSaveReplies.length === 2'), 'sample and cancel saves to finish');
  assert.deepEqual(await cdp.evaluate('draftSaveReplies'), [true, true]);
  await saved({ title, text: '', pendingText: null });
  await forceQuit();

  await writeFile(draftPath, '{invalid json', 'utf8');
  await launch();
  assert.match(await cdp.evaluate('document.querySelector("#code").textContent'), /function debounce/);
  assert.equal(await cdp.evaluate('document.querySelector("#draft-status").hidden'), false);
  assert.equal(await readFile(draftPath, 'utf8'), '{invalid json');
  console.log('PASS normal window, widget and dialog recovery after forced termination, Cancel, empty draft and corrupt file fallback');
} finally {
  await forceQuit();
}
