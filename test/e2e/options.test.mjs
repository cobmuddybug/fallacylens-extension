import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { setup, waitFor, attach, findTarget, GOOD_KEY } from "./harness.mjs";

let env, page;
const storage = () => env.sw.eval("chrome.storage.local.get(null)");
const status = () => page.eval(`document.getElementById("status").textContent`);
const submit = key => page.eval(`(() => { document.getElementById("key").value = ${JSON.stringify(key)}; document.getElementById("key-form").requestSubmit(); })()`);

before(async () => {
  env = await setup();
  // A fresh install opens the options page on its own.
  const info = await findTarget(env.cdp, t => t.url.endsWith("/src/options.html"), "options page opened on install");
  page = await attach(env.cdp, info.targetId);
  await waitFor(() => page.eval("document.readyState === 'complete' && !!document.getElementById('key-form')"), { what: "options load" });
});
after(async () => { await env?.close(); });

test("rejects an empty key and one with spaces without calling OpenRouter", async () => {
  const before = env.server.state.keyChecks.length;
  await submit("   ");
  await waitFor(async () => /Paste an OpenRouter API key/.test(await status()), { what: "empty message" });
  await submit("sk-or bad key");
  await waitFor(async () => /spaces or line breaks/.test(await status()), { what: "spaces message" });
  assert.equal(env.server.state.keyChecks.length, before);
});

test("a key OpenRouter rejects is not saved", async () => {
  await submit("sk-or-test-wrong");
  await waitFor(async () => /rejected that key/.test(await status()), { what: "rejection" });
  assert.equal(await env.getKey(), "");
});

test("a good key is saved, cleared from the field, and shown only as a hint", async () => {
  await submit(GOOD_KEY);
  await waitFor(async () => (await env.getKey()) === GOOD_KEY, { what: "key saved" });
  assert.equal(await page.eval(`document.getElementById("hint").textContent`), "sk-or-…good");
  assert.equal(await page.eval(`document.getElementById("key").value`), "");
  assert.equal(await page.eval(`document.getElementById("key-form").hidden`), true);
  assert.ok(!(await page.eval("document.body.innerText")).includes(GOOD_KEY));
});

test("threshold slider is stored", async () => {
  await page.eval(`(() => { const t = document.getElementById("threshold"); t.value = "70"; t.dispatchEvent(new Event("input", { bubbles: true })); })()`);
  await waitFor(async () => (await storage()).threshold === 70, { what: "threshold saved" });
  assert.equal(await page.eval(`document.getElementById("threshold-value").textContent`), "70");
});

test("remove deletes the key and shows the form again", async () => {
  await page.eval(`document.getElementById("remove").click()`);
  await waitFor(async () => (await env.getKey()) === "", { what: "key removed" });
  assert.equal(await page.eval(`document.getElementById("key-form").hidden`), false);
});

test("the key is not kept in chrome.storage.local, which content scripts can read", async () => {
  await submit(GOOD_KEY);
  await waitFor(async () => (await env.getKey()) === GOOD_KEY, { what: "key saved" });
  assert.equal((await storage()).key, undefined);
});
