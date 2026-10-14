import test from "node:test";
import assert from "node:assert/strict";
import { runCheck } from "../../src/check.js";
import { describeError } from "../../src/errors.js";
import { JevError } from "../../src/jev.js";
import { fakeFetch, answers, noSleep } from "./fakefetch.mjs";

const TEXT = "Either you agree with everything I say, or you hate this country.";
async function collect(text, opts) {
  const posts = [];
  await runCheck(text, { key: "sk-or-test-key", threshold: 50, sleep: noSleep, post: m => posts.push(m), ...opts });
  return posts;
}

test("no key: asks for one before anything else", async () => {
  const f = fakeFetch(answers());
  assert.deepEqual(await collect("", { key: "", fetch: f }), [{ type: "error", kind: "nokey", message: "Add your OpenRouter key to start." }]);
  assert.equal(f.calls.length, 0);
});

test("too short after trimming", async () => {
  const posts = await collect("   Hi there.   ", { fetch: fakeFetch(answers()) });
  assert.deepEqual(posts, [{ type: "error", kind: "short", message: "Select a sentence or more." }]);
});

test("too long", async () => {
  const posts = await collect("a".repeat(500_001), { fetch: fakeFetch(answers()) });
  assert.equal(posts[0].kind, "long");
  assert.match(posts[0].message, /500,001 characters; the limit is 500,000/);
});

test("success: progress, then done with rows and no key in any message", async () => {
  const posts = await collect(TEXT, { fetch: fakeFetch(answers({ black_or_white: 0.93 })) });
  assert.equal(posts[0].type, "progress");
  assert.equal(posts[0].chars, TEXT.length);
  const done = posts.at(-1);
  assert.equal(done.type, "done");
  assert.equal(done.rows[0].id, "black_or_white");
  assert.equal(done.rows[0].example.length > 10, true);
  assert.deepEqual([done.threshold, done.analysed, done.total, done.failed], [50, 1, 1, 0]);
  assert.ok(!JSON.stringify(posts).includes("sk-or-test-key"));
});

test("failure is described for the card", async () => {
  const posts = await collect(TEXT, { fetch: fakeFetch(() => ({ status: 402, body: {} })) });
  assert.deepEqual(posts.at(-1), { type: "error", ...describeError(new JevError("x", { status: 402 })) });
  assert.equal(posts.at(-1).kind, "credit");
});

test("an abort posts nothing further", async () => {
  const ctrl = new AbortController();
  const f = fakeFetch(async () => { ctrl.abort(); throw new DOMException("aborted", "AbortError"); });
  const posts = await collect(TEXT, { fetch: f, signal: ctrl.signal });
  assert.ok(posts.every(p => p.type === "progress"));
});

test("describeError covers every kind", () => {
  const k = e => describeError(e).kind;
  assert.equal(k(new JevError("x", { type: "max_tokens" })), "dense");
  assert.equal(k(new JevError("x", { type: "network" })), "network");
  assert.equal(k(new JevError("x", { type: "format" })), "format");
  assert.equal(k(new JevError("x", { status: 401 })), "key");
  assert.equal(k(new JevError("x", { status: 403 })), "key");
  assert.equal(k(new JevError("x", { status: 402 })), "credit");
  assert.equal(k(new JevError("x", { status: 429 })), "rate");
  assert.equal(k(new JevError("OpenRouter 500: boom", { status: 500 })), "other");
  assert.equal(describeError(new JevError("OpenRouter 500: boom", { status: 500 })).message, "OpenRouter 500: boom");
  assert.equal(k(new TypeError("bug")), "other");
});
