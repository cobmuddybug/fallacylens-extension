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
  await popup.send("Page.reload");
  await waitFor(() => popup.eval(`document.querySelector("fallacy-lens-card")?.shadowRoot?.textContent.includes("expired")`), { what: "reloaded popup says the check expired" });
  await env.cdp.send("Target.closeTarget", { targetId: info.targetId });
});

test("select-all keeps the card on screen", async () => {
  const page = await fresh("/page.html");
  const text = await page.eval("(() => { getSelection().selectAllChildren(document.body); return getSelection().toString(); })()");
  await page.check(text);
  const c = await cardSays(page, /Slippery slope/, "results");
  const vh = await page.eval("innerHeight");
  assert.ok(c.top >= 0 && c.bottom <= vh, `card ${c.top}..${c.bottom} should be inside the ${vh}px viewport`);
  await page.close();
});

test("card shows above a modal dialog and its close button works", async () => {
  const page = await fresh("/dialog.html");
  await checkOn(page, "fallacy");
  const c = await cardSays(page, /Slippery slope/, "results");
  const hit = await page.eval(`(() => { const host = document.querySelector("fallacy-lens-card"), b = host.getBoundingClientRect();
    return document.elementFromPoint(b.left + b.width / 2, b.top + 20) === host; })()`);
  assert.ok(hit, "the card, not the dialog, should be on top");
  const x = await page.eval(`(() => { const b = document.querySelector("fallacy-lens-card").shadowRoot.querySelector("button.close").getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; })()`);
  for (const type of ["mousePressed", "mouseReleased"]) {
    await page.send("Input.dispatchMouseEvent", { type, x: x[0], y: x[1], button: "left", clickCount: 1 });
  }
  await waitFor(async () => (await page.card()) === null, { what: "real click on ✕ closes the card" });
  assert.ok(c.width > 0);
  await page.close();
});

test("the card sends a heartbeat while a check is running", async () => {
  const page = await fresh("/page.html");
  await checkOn(page, "slow");
  await cardSays(page, /No fallacies scored/, "slow result");
  assert.match((await page.card()).log, /"type":"pong"/, "background should answer the card's pings");
  await page.close();
});

test("the card's content-script world cannot read the key", async () => {
  const page = await fresh("/page.html");
  await checkOn(page, "fallacy");
  await cardSays(page, /Slippery slope/, "results");
  const seen = await page.evalContentWorld("chrome.storage.local.get(null).then(o => JSON.stringify(o))");
  assert.ok(!seen.includes(GOOD_KEY), `content script saw: ${seen}`);
  assert.match(seen, /"threshold":50/, "the probe really reads storage.local from the content world");
  await page.close();
});

test("a key saved by an older version is moved out of chrome.storage.local", async () => {
  await env.setKey("");
  await env.sw.eval(`chrome.storage.local.set({ key: ${JSON.stringify(GOOD_KEY)} })`);
  const page = await fresh("/page.html");
  await checkOn(page, "fallacy");
  await cardSays(page, /Slippery slope/, "results with the migrated key");
  assert.equal(await env.getKey(), GOOD_KEY);
  assert.equal((await env.sw.eval("chrome.storage.local.get(null)")).key, undefined);
  await page.close();
});

test("partial results say why parts failed", async () => {
  const page = await fresh("/parts.html");
  await checkOn(page, "long");
  const c = await cardSays(page, /parts failed/, "partial warning");
  assert.match(c.text, /1 of 2 parts failed/);
  assert.match(c.text, /OpenRouter 400: fake part failure/);
  await page.close();
});

test("card is re-placed when the window narrows", async () => {
  const page = await fresh("/page.html");
  await checkOn(page, "fallacy");
  await cardSays(page, /Slippery slope/, "results");
  await page.eval(`(() => { const p = document.getElementById("fallacy"); p.style.marginLeft = "700px"; })()`);
  await page.send("Emulation.setDeviceMetricsOverride", { width: 320, height: 640, deviceScaleFactor: 1, mobile: false });
  const vw = await page.eval("document.documentElement.clientWidth");
  await waitFor(async () => { const c = await page.card(); return c.right <= vw - 7.5 && c.left >= 7.5; }, { what: `card inside ${vw}px after resize` });
  await page.close();
});

test("a tel field's selection is checked even with no fallback text", async () => {
  const page = await fresh("/fields.html");
  await page.eval(`(() => { const el = document.getElementById("tel"); el.focus(); el.select(); })()`);
  await page.check("");
  await cardSays(page, /No fallacies scored|Slippery/, "a result, not 'select a sentence'");
  assert.match(env.server.state.requests.at(-1).record, /ghosts aren't real/);
  await page.close();
});

test("a textarea inside a shadow root keeps its line breaks", async () => {
  const page = await fresh("/fields.html");
  await page.eval(`(() => { const t = document.getElementById("box").shadowRoot.getElementById("inner"); t.focus(); t.select(); })()`);
  await page.check("First line of the shadow field, long enough. Second part, slippery as ever.");
  await cardSays(page, /Slippery slope/, "results");
  assert.match(env.server.state.requests.at(-1).record, /enough\.\n\nSecond part/);
  await page.close();
});

test("closing gives focus back to where it was", async () => {
  const page = await fresh("/page.html");
  await checkOn(page, "field");
  await cardSays(page, /Slippery slope/, "results");
  await page.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  await waitFor(async () => (await page.card()) === null, { what: "closed" });
  assert.equal(await page.eval("document.activeElement.id"), "field");
  await page.close();
});

test("Esc typed into the page's own field leaves the card open", async () => {
  const page = await fresh("/fields.html");
  await page.check("Nobody has proven ghosts aren't real, so they are.");
  await cardSays(page, /No fallacies scored|Slippery/, "a result");
  await page.eval(`document.getElementById("other").focus()`);
  await page.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  await new Promise(r => setTimeout(r, 200));
  assert.notEqual(await page.card(), null, "Esc meant for the page's field should not close the card");
  await page.close();
});

test("expand/collapse arrows are hidden from screen readers", async () => {
  const page = await fresh("/page.html");
  await checkOn(page, "fallacy");
  await cardSays(page, /others below/, "results");
  const hidden = await page.eval(`document.querySelector("fallacy-lens-card").shadowRoot.querySelector("button.more [aria-hidden=true]")?.textContent`);
  assert.equal(hidden, "▸");
  await page.close();
});

test("a check in a small iframe shows the card on the top page", async () => {
  const page = await fresh("/frame.html");
  await page.eval(`(() => { const d = document.getElementById("f").contentDocument, r = d.createRange();
    r.selectNodeContents(d.getElementById("fallacy")); d.getSelection().removeAllRanges(); d.getSelection().addRange(r); })()`);
  await page.checkInFrame("");
  await cardSays(page, /Slippery slope/, "card in the top document");
  await page.close();
});
