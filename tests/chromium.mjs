import { setTimeout as delay } from 'node:timers/promises';

export async function connect(port, matches = target => target.type === 'page') {
  const deadline = Date.now() + 15_000;
  let page;
  while (!page && Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`, { signal: AbortSignal.timeout(1000) });
      page = (await response.json()).find(matches);
    } catch {
      // The browser may still be starting.
    }
    if (!page) await delay(100);
  }
  if (!page) throw new Error('Browser debugging page did not open');

  const socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  let nextId = 0;
  const pending = new Map();
  socket.addEventListener('message', ({ data }) => {
    const { id, error, result } = JSON.parse(data);
    if (!pending.has(id)) return;
    const reply = pending.get(id);
    pending.delete(id);
    if (error) reply.reject(new Error(error.message));
    else reply.resolve(result);
  });
  function send(method, params = {}) {
    const id = ++nextId;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`Timed out: ${method}`));
      }, 12_000);
      pending.set(id, {
        resolve: value => { clearTimeout(timer); resolve(value); },
        reject: error => { clearTimeout(timer); reject(error); }
      });
      socket.send(JSON.stringify({ id, method, params }));
    });
  }
  async function evaluate(expression) {
    const { result, exceptionDetails } = await send('Runtime.evaluate', {
      expression, awaitPromise: true, returnByValue: true
    });
    if (exceptionDetails) throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text);
    return result.value;
  }
  return { send, evaluate, close: () => socket.close() };
}
