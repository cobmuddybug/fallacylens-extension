import test, { before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { setup, waitFor, attach, findTarget, selectExpr, GOOD_KEY, FALLACY } from "./harness.mjs";

let env, n = 0;
const fresh = path => env.openPage(`${path}?t=${++n}`);
before(async () => { env = await setup(); });
after(async () => { await env?.close(); });
beforeEach(async () => {
  env.server.state.status = 0;
  await env.setKey(GOOD_KEY);
  await env.sw.eval("chrome.storage.local.set({ threshold: 50 })");
});

async function checkOn(page, id) {
  const text = await page.eval(selectExpr(id));
  await page.check(text);
  return text;
}
const cardSays = (page, re, what) => waitFor(async () => { const c = await page.card(); return c && re.test(c.text) && c; }, { what });

test("results: top fallacies, the rest folded, definition on click", async () => {
  const page = await fresh("/page.html");
  await checkOn(page, "fallacy");
  const c = await cardSays(page, /Slippery slope/, "results");
  assert.match(c.text, /91/);
  assert.match(c.text, /Strawman/);
  assert.match(c.text, /21 others below 50/);
  assert.doesNotMatch(c.text, /Bandwagon/, "rows below the threshold start folded");
  assert.match(c.text, /not a verdict/);
  assert.match(c.text, /\$0\.0003/);
  const selBottom = await page.eval("getSelection().getRangeAt(0).getBoundingClientRect().bottom");
  assert.ok(c.top >= selBottom, `card (${c.top}) should sit below the selection (${selBottom})`);
  await page.eval(`document.querySelector("fallacy-lens-card").shadowRoot.querySelector("button.row").click()`);
  await cardSays(page, /Asserting that if we allow A[\s\S]*e\.g\. “If we let students redo one test/, "definition and example");
  await page.close();
});

test("threshold from settings decides what shows", async () => {
  await env.sw.eval("chrome.storage.local.set({ threshold: 80 })");
  const page = await fresh("/page.html");
  await checkOn(page, "fallacy");
  const c = await cardSays(page, /Slippery slope/, "results");
  assert.doesNotMatch(c.text, /Strawman/);
  assert.match(c.text, /23 others below 80/);
  await page.close();
});

test("nothing stands out", async () => {
  const page = await fresh("/page.html");
  await checkOn(page, "calm");
  await cardSays(page, /No fallacies scored 50 or more[\s\S]*Show all scores/, "calm result");
  await page.close();
});

test("too short", async () => {
  const page = await fresh("/page.html");
  await checkOn(page, "short");
  await cardSays(page, /Select a sentence or more/, "short message");
  await page.close();
});

test("no key: prompt plus a button that opens settings", async () => {
  await env.setKey("");
  const page = await fresh("/page.html");
  await checkOn(page, "fallacy");
  await cardSays(page, /Add your OpenRouter key to start/, "no-key prompt");
  // The install-time options tab would satisfy findTarget on its own, and openOptionsPage would just
  // focus it, so close any open options tabs first.
  for (const t of (await env.cdp.send("Target.getTargets")).targetInfos.filter(t => t.url.endsWith("/src/options.html"))) {
    await env.cdp.send("Target.closeTarget", { targetId: t.targetId });
  }
  await page.eval(`document.querySelector("fallacy-lens-card").shadowRoot.querySelector("button.action").click()`);
  await findTarget(env.cdp, t => t.url.endsWith("/src/options.html"), "options tab");
  await page.close();
});

test("rejected key", async () => {
  env.server.state.status = 401;
  const page = await fresh("/page.html");
  await checkOn(page, "fallacy");
  await cardSays(page, /OpenRouter rejected your key[\s\S]*Open settings/, "key error");
  await page.close();
});

test("Esc and ✕ close the card", async () => {
  const page = await fresh("/page.html");
  await checkOn(page, "fallacy");
  await cardSays(page, /Slippery slope/, "results");
  await page.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  await waitFor(async () => (await page.card()) === null, { what: "Esc closes" });
  await checkOn(page, "fallacy");
  await cardSays(page, /Slippery slope/, "results again");
  await page.eval(`document.querySelector("fallacy-lens-card").shadowRoot.querySelector("button.close").click()`);
  await waitFor(async () => (await page.card()) === null, { what: "✕ closes" });
  await page.close();
});

test("a new check replaces the old card", async () => {
  const page = await fresh("/page.html");
  await checkOn(page, "fallacy");
  await cardSays(page, /Slippery slope/, "first");
  await checkOn(page, "calm");
  const c = await cardSays(page, /No fallacies scored/, "second");
  assert.equal(c.count, 1);
  await page.close();
});

test("closing mid-check cancels the request", async () => {
  const page = await fresh("/page.html");
  const before = env.server.state.aborted;
  await checkOn(page, "slow");
  await cardSays(page, /Checking/, "spinner");
  await waitFor(() => env.server.state.requests.some(r => r.record.includes("SLOW")), { what: "request sent" });
  await page.eval(`document.querySelector("fallacy-lens-card").shadowRoot.querySelector("button.close").click()`);
  await waitFor(() => env.server.state.aborted > before, { what: "server sees the request cancelled" });
  await page.close();
});

test("the key never reaches the page or the card", async () => {
  const page = await fresh("/page.html");
  await checkOn(page, "fallacy");
  const c = await cardSays(page, /Slippery slope/, "results");
  assert.ok(env.server.state.requests.at(-1).auth === `Bearer ${GOOD_KEY}`, "the key is used for Jev");
  assert.ok(c.log.includes('"type":"done"'), "card message log is captured");
  for (const s of [c.html, c.log, await page.eval("document.documentElement.outerHTML")]) assert.ok(!s.includes(GOOD_KEY));
  await page.close();
});

test("card flips above a selection near the bottom of the window", async () => {
  const page = await fresh("/flip.html");
  await page.eval(`(() => { const r = document.getElementById("fallacy").getBoundingClientRect(); scrollTo(0, scrollY + r.bottom - innerHeight + 10); })()`);
  await checkOn(page, "fallacy");
  const c = await cardSays(page, /Slippery slope/, "results");
  const selTop = await page.eval("getSelection().getRangeAt(0).getBoundingClientRect().top");
  assert.ok(c.bottom <= selTop, `card bottom ${c.bottom} should be above selection top ${selTop}`);
  await page.close();
});

test("card fits a narrow viewport", async () => {
  const page = await fresh("/page.html");
  await page.send("Emulation.setDeviceMetricsOverride", { width: 320, height: 640, deviceScaleFactor: 1, mobile: false });
  await checkOn(page, "fallacy");
  const c = await cardSays(page, /Slippery slope/, "results");
  // clientWidth, not 320: a vertical scrollbar may take some of the width. The page's own textarea is
  // wider than 320px, so page scrollWidth says nothing about the card.
  const vw = await page.eval("document.documentElement.clientWidth");
  assert.ok(c.width <= vw - 16 + 0.5, `width ${c.width} in a ${vw}px viewport`);
  assert.ok(c.left >= 7.5 && c.right <= vw - 7.5, `left ${c.left} right ${c.right} in ${vw}px`);
  await page.close();
});

test("textarea selection keeps line breaks", async () => {
  const page = await fresh("/page.html");
  await checkOn(page, "field");
  await cardSays(page, /Slippery slope/, "results");
  assert.match(env.server.state.requests.at(-1).record, /check\.\n\nSecond paragraph/);
  await page.close();
});

test("card is styled under a strict CSP", async () => {
  const page = await fresh("/csp.html");
  await checkOn(page, "fallacy");
  const c = await cardSays(page, /Slippery slope/, "results");
  assert.notEqual(c.bg, "rgba(0, 0, 0, 0)", "card background should come from its stylesheet");
  await page.close();
});

test("restricted page falls back to a popup window", async () => {
  await env.sw.eval(`(async () => {
    const tab = await chrome.tabs.create({ url: "chrome://version" });
    await new Promise(r => setTimeout(r, 500));
    await fallacyLensCheck({ menuItemId: "fallacylens-check", frameId: 0, selectionText: ${JSON.stringify(FALLACY)} }, tab);
  })()`);
  const info = await findTarget(env.cdp, t => t.url.includes("/src/popup-card.html#"), "popup window");
  const popup = await attach(env.cdp, info.targetId);
  await waitFor(() => popup.eval(`document.querySelector("fallacy-lens-card")?.shadowRoot?.textContent.includes("Slippery slope")`), { what: "popup results" });
  await env.cdp.send("Target.closeTarget", { targetId: info.targetId });
});
