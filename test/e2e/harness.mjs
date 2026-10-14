// Headless Chromium with a test build of the extension, driven over the DevTools protocol, and a fake
// OpenRouter on 127.0.0.1. The test build differs from the real one only where patch() says.
import { spawn } from "node:child_process";
import { once } from "node:events";
import { cpSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import http from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");
export const GOOD_KEY = "sk-or-test-good";
export const FALLACY = "My opponent wants to add a bike lane on Elm Street. Let's be honest about what that really means: she wants to ban cars from this town entirely. First it's one lane, then it's two, and before you know it the whole downtown is a ghost town. And what would she know? She can't even keep her own lawn mowed.";
const CALM = "The city's traffic report found that collisions on Elm Street fell by 18 percent after the speed limit was lowered. The authors caution that other changes happened the same year.";

const PAGES = {
  "/page.html": { html: `<!doctype html><meta charset="utf-8"><title>t</title><body style="margin:40px;font:16px serif">
    <p id="fallacy">${FALLACY}</p><p id="calm">${CALM}</p><p id="short">Hi there.</p>
    <p id="slow">SLOW: ${CALM}</p>
    <textarea id="field" rows="6" cols="60">First paragraph of the field, long enough to check.\n\nSecond paragraph, with slippery reasoning in it.</textarea>
    <div style="height:2000px"></div></body>` },
  "/flip.html": { html: `<!doctype html><meta charset="utf-8"><body style="margin:0;font:16px serif">
    <div style="height:1500px"></div><p id="fallacy" style="margin:0 40px">${FALLACY}</p><div style="height:1500px"></div></body>` },
  "/dialog.html": { html: `<!doctype html><meta charset="utf-8"><body><p>Behind the dialog.</p>
    <dialog id="d"><p id="fallacy">${FALLACY}</p></dialog>
    <script>document.getElementById("d").showModal()</script></body>` },
  "/parts.html": { html: `<!doctype html><meta charset="utf-8"><body><div id="long">
    <p>${"Calm sentence about rivers and their banks. ".repeat(1400)}</p>
    <p>PARTFAIL ${"Another calm sentence about gardens. ".repeat(1400)}</p></div></body>` },
  "/fields.html": { html: `<!doctype html><meta charset="utf-8"><body>
    <input id="tel" type="tel" value="Nobody has proven ghosts aren't real, so they are.">
    <input id="other" type="text" value="page field">
    <shadow-box id="box"></shadow-box>
    <script>
      const root = document.getElementById("box").attachShadow({ mode: "open" });
      root.innerHTML = '<textarea id="inner" rows="5" cols="40">First line of the shadow field, long enough.\\n\\nSecond part, slippery as ever.</textarea>';
    </script></body>` },
  "/frame.html": { html: `<!doctype html><meta charset="utf-8"><body><p>Top page.</p>
    <iframe id="f" style="width:300px;height:150px" srcdoc="<p id='fallacy'>${FALLACY.replace(/'/g, "&#39;")}</p>"></iframe></body>` },
  "/csp.html": { headers: { "Content-Security-Policy": "default-src 'none'" },
    html: `<!doctype html><meta charset="utf-8"><body><p id="fallacy">${FALLACY}</p></body>` },
};

function patch(file, from, to) {
  const s = readFileSync(file, "utf8");
  if (!s.includes(from)) throw new Error(`test build: "${from}" not found in ${file}`);
  writeFileSync(file, s.replaceAll(from, to));
}

function buildTestCopy(origin) {
  const dir = mkdtempSync(join(tmpdir(), "fl-ext-"));
  for (const p of ["manifest.json", "src", "icons"]) cpSync(join(ROOT, p), join(dir, p), { recursive: true });
  patch(join(dir, "src/config.js"), "https://openrouter.ai/api/alpha/decisions", `${origin}/api/alpha/decisions`);
  patch(join(dir, "src/config.js"), "https://openrouter.ai/api/v1/key", `${origin}/api/v1/key`);
  patch(join(dir, "src/card.js"), 'const SHADOW_MODE = "closed";', 'const SHADOW_MODE = "open";');
  if (readFileSync(join(dir, "src/card.js"), "utf8").includes("const PING_MS = 20_000;")) {
    patch(join(dir, "src/card.js"), "const PING_MS = 20_000;", "const PING_MS = 200;"); // fast heartbeat for tests
  }
  patch(join(dir, "src/card.js"), "/* e2e-log */", 'host.dataset.log = (host.dataset.log || "") + JSON.stringify(m) + "\\n";');
  const m = JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8"));
  m.host_permissions.push("http://127.0.0.1/*"); // lets tests inject without a real right-click (activeTab)
  writeFileSync(join(dir, "manifest.json"), JSON.stringify(m));
  return dir;
}

async function fakeServer() {
  const state = { status: 0, requests: [], keyChecks: [], aborted: 0 };
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://127.0.0.1");
    const json = (code, body) => { res.writeHead(code, { "content-type": "application/json" }); res.end(JSON.stringify(body)); };
    if (req.method === "GET" && url.pathname === "/api/v1/key") {
      state.keyChecks.push(req.headers.authorization);
      return req.headers.authorization === `Bearer ${GOOD_KEY}` ? json(200, { data: {} }) : json(401, { error: { message: "bad key" } });
    }
    if (req.method === "POST" && url.pathname === "/api/alpha/decisions") {
      let body = "";
      for await (const c of req) body += c;
      const payload = JSON.parse(body);
      const record = payload.state.records[0].record;
      state.requests.push({ record, auth: req.headers.authorization });
      if (record.includes("SLOW")) {
        let gone = false;
        res.on("close", () => { if (!res.writableEnded) { gone = true; state.aborted++; } });
        await new Promise(r => setTimeout(r, 3000));
        if (gone) return;
      }
      if (state.status) return json(state.status, { error: { message: "fake failure" } });
      if (record.includes("PARTFAIL")) return json(400, { error: { message: "fake part failure" } });
      const hot = /ghost town|slippery/i.test(record);
      const hotScores = { slippery_slope: 0.91, strawman: 0.74, ad_hominem: 0.58 };
      const answers = {};
      for (const id of Object.keys(payload.questions)) answers[id] = { noul: hot ? hotScores[id] ?? 0.04 : 0.03 };
      return json(200, { answers, usage: { cost: 0.0003 } });
    }
    const page = PAGES[url.pathname];
    if (page) { res.writeHead(200, { "content-type": "text/html; charset=utf-8", ...page.headers }); return res.end(page.html); }
    res.writeHead(404); res.end();
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  return { state, origin: `http://127.0.0.1:${server.address().port}`, close: () => server.close() };
}

class CDP {
  static async connect(url) {
    const ws = new WebSocket(url);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    return new CDP(ws);
  }
  constructor(ws) {
    this.ws = ws; this.id = 0; this.pending = new Map(); this.listeners = new Set();
    ws.onmessage = e => {
      const m = JSON.parse(e.data);
      if (m.method) for (const fn of this.listeners) fn(m);
      const p = m.id && this.pending.get(m.id);
      if (!p) return;
      this.pending.delete(m.id);
      m.error ? p.rej(new Error(`${p.method}: ${m.error.message}`)) : p.res(m.result);
    };
  }
  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  send(method, params = {}, sessionId) {
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params, sessionId }));
    return new Promise((res, rej) => this.pending.set(id, { res, rej, method }));
  }
}

export async function waitFor(fn, { timeout = 8000, what = "condition" } = {}) {
  const end = Date.now() + timeout;
  let last;
  while (Date.now() < end) {
    try { last = await fn(); if (last) return last; } catch (e) { last = e; }
    await new Promise(r => setTimeout(r, 100));
  }
  throw new Error(`timed out waiting for ${what} (last: ${last instanceof Error ? last.message : JSON.stringify(last)})`);
}

export async function attach(cdp, targetId) {
  const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
  const send = (method, params) => cdp.send(method, params, sessionId);
  const evaluate = async expression => {
    const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(`eval: ${r.exceptionDetails.exception?.description ?? r.exceptionDetails.text}`);
    return r.result.value;
  };
  return { targetId, sessionId, send, eval: evaluate };
}

export async function findTarget(cdp, pred, what) {
  return waitFor(async () => (await cdp.send("Target.getTargets")).targetInfos.find(pred), { what });
}

/** Select an element's text (or a textarea's whole value, focused) and return what was selected. */
export const selectExpr = id => `(() => {
  const el = document.getElementById(${JSON.stringify(id)});
  if (el.tagName === "TEXTAREA") { el.focus(); el.select(); return el.value; }
  const r = document.createRange(); r.selectNodeContents(el);
  const s = getSelection(); s.removeAllRanges(); s.addRange(r); return s.toString();
})()`;

/** The newest card's state, read through its (open, in the test build) shadow root. */
export const CARD = `(() => {
  const all = document.querySelectorAll("fallacy-lens-card");
  if (!all.length) return null;
  const host = all[all.length - 1], card = host.shadowRoot.querySelector(".card"), b = host.getBoundingClientRect();
  return { count: all.length, text: card.innerText, top: b.top, bottom: b.bottom, left: b.left, right: b.right,
           width: b.width, log: host.dataset.log || "", bg: getComputedStyle(card).backgroundColor,
           html: host.shadowRoot.innerHTML };
})()`;

export async function setup() {
  const server = await fakeServer();
  const ext = buildTestCopy(server.origin);
  const profile = mkdtempSync(join(tmpdir(), "fl-prof-"));
  const proc = spawn(process.env.CHROMIUM || "chromium", [
    "--headless=new", "--no-first-run", "--no-default-browser-check", `--user-data-dir=${profile}`,
    "--remote-debugging-port=0", "--window-size=1200,800",
    "--disable-features=DisableLoadExtensionCommandLineSwitch",
    `--disable-extensions-except=${ext}`, `--load-extension=${ext}`, "about:blank",
  ], { stdio: ["ignore", "ignore", "pipe"] });
  const wsUrl = await new Promise((res, rej) => {
    let buf = "";
    const t = setTimeout(() => rej(new Error(`Chromium did not start:\n${buf}`)), 15000);
    proc.stderr.on("data", d => {
      buf += d;
      const m = buf.match(/DevTools listening on (ws:\/\/\S+)/);
      if (m) { clearTimeout(t); res(m[1]); }
    });
    proc.on("exit", code => rej(new Error(`Chromium exited (${code}):\n${buf}`)));
  });
  const cleanup = async () => {
    proc.kill();
    await once(proc, "exit").catch(() => {});
    server.close();
    rmSync(profile, { recursive: true, force: true });
    rmSync(ext, { recursive: true, force: true });
  };
  let cdp, swInfo, sw;
  try {
    cdp = await CDP.connect(wsUrl);
    swInfo = await findTarget(cdp, t => t.type === "service_worker" && t.url.endsWith("/src/background.js"), "service worker");
    sw = await attach(cdp, swInfo.targetId);
  } catch (e) {
    await cleanup(); // otherwise a failed setup leaves Chromium running and the test process never exits
    throw e;
  }
  const extId = new URL(swInfo.url).host;

  async function openPage(url) {
    const { targetId } = await cdp.send("Target.createTarget", { url: url.startsWith("http") || url.includes(":") ? url : server.origin + url });
    const page = await attach(cdp, targetId);
    await waitFor(() => page.eval("document.readyState === 'complete'"), { what: `load ${url}` });
    page.close = () => cdp.send("Target.closeTarget", { targetId });
    /** Run a check on this tab the way a right-click would. */
    page.check = selectionText => sw.eval(`(async () => {
      const tab = (await chrome.tabs.query({})).find(t => (t.url || t.pendingUrl || "") === ${JSON.stringify(url.startsWith("http") ? url : server.origin + url)});
      if (!tab) throw new Error("no tab");
      await fallacyLensCheck({ menuItemId: "fallacylens-check", frameId: 0, selectionText: ${JSON.stringify(selectionText)} }, tab);
    })()`);
    page.card = () => page.eval(CARD);
    /** Run a check as if the right-click happened inside this page's first child frame. */
    page.checkInFrame = selectionText => sw.eval(`(async () => {
      const tab = (await chrome.tabs.query({})).find(t => (t.url || t.pendingUrl || "") === ${JSON.stringify(url.startsWith("http") ? url : server.origin + url)});
      const frames = await chrome.scripting.executeScript({ target: { tabId: tab.id, allFrames: true }, func: () => location.href });
      const child = frames.find(f => f.frameId !== 0);
      await fallacyLensCheck({ menuItemId: "fallacylens-check", frameId: child.frameId, selectionText: ${JSON.stringify(selectionText)} }, tab);
    })()`);
    /** Evaluate in the extension's content-script world on this page (exists once a card was injected). */
    page.evalContentWorld = async expression => {
      const contexts = [];
      const off = cdp.on(m => { if (m.sessionId === page.sessionId && m.method === "Runtime.executionContextCreated") contexts.push(m.params.context); });
      await page.send("Runtime.enable");
      off();
      const ctx = contexts.find(c => c.origin.startsWith("chrome-extension://") || c.name === "Fallacy Lens");
      if (!ctx) throw new Error(`no content-script world among ${contexts.map(c => c.name || c.origin).join(", ")}`);
      const r = await page.send("Runtime.evaluate", { expression, contextId: ctx.id, awaitPromise: true, returnByValue: true });
      if (r.exceptionDetails) throw new Error(`eval: ${r.exceptionDetails.exception?.description ?? r.exceptionDetails.text}`);
      return r.result.value;
    };
    return page;
  }

  return {
    cdp, sw, server, extId, openPage,
    /** Stop the service worker, as Chrome does after 30 s idle. env.sw is unusable afterwards. */
    async stopWorker() {
      await cdp.send("Target.detachFromTarget", { sessionId: sw.sessionId });
      await cdp.send("Target.closeTarget", { targetId: sw.targetId });
      await waitFor(async () => !(await cdp.send("Target.getTargets")).targetInfos.some(t => t.targetId === sw.targetId), { what: "worker stopped" });
    },
    setKey: key => sw.eval(key ? `fallacyLensKeyStore.setKey(${JSON.stringify(key)})` : "fallacyLensKeyStore.removeKey()"),
    getKey: () => sw.eval("fallacyLensKeyStore.getKey()"),
    close: cleanup,
  };
}
