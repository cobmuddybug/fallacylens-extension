import test from "node:test";
import assert from "node:assert/strict";
import { validateKey, keyHint, checkKey } from "../../src/keys.js";
import { KEYCHECK_URL } from "../../src/config.js";
import { fakeFetch } from "./fakefetch.mjs";

test("validateKey", () => {
  assert.match(validateKey(""), /Paste an OpenRouter API key/);
  assert.match(validateKey("sk-or abc"), /spaces or line breaks/);
  assert.equal(validateKey("sk-or-test-good"), "");
});

test("keyHint shows only the ends", () => {
  assert.equal(keyHint("sk-or-test-good"), "sk-or-…good");
  assert.equal(keyHint("short"), "…");
  assert.equal(keyHint(""), "");
});

test("checkKey accepts 200 and sends the key only to the key endpoint", async () => {
  const f = fakeFetch(() => ({ status: 200, body: { data: {} } }));
  await checkKey("sk-or-test-good", f);
  assert.equal(f.calls[0].url, KEYCHECK_URL);
  assert.equal(f.calls[0].headers.Authorization, "Bearer sk-or-test-good");
});

test("checkKey explains failures", async () => {
  await assert.rejects(checkKey("k", fakeFetch(() => ({ status: 401 }))), /rejected that key/);
  await assert.rejects(checkKey("k", fakeFetch(() => ({ status: 503 }))), /error \(503\)/);
  await assert.rejects(checkKey("k", fakeFetch(() => { throw new TypeError("offline"); })), /Couldn't reach OpenRouter/);
});
