import test from "node:test";
import assert from "node:assert/strict";
import { JevError, QUESTIONS, buildPayload, yesProbability, scoresFrom, askJev, aggregate, analyze } from "../../src/jev.js";
import { DECISIONS_URL, MODEL } from "../../src/config.js";
import { fakeFetch, answers, noSleep, record } from "./fakefetch.mjs";

const KEY = "sk-or-test-key";
const TEXT = "If we allow this, everything will collapse and the town will be ruined forever.";

test("payload carries all 24 questions in the desktop app's wording", () => {
  const p = buildPayload(TEXT, 0, 1);
  assert.equal(p.model, MODEL);
  assert.equal(Object.keys(p.questions).length, 24);
  assert.deepEqual(p.state.records, [{ id: "text", record: TEXT }]);
  assert.equal(p.state.description, "A passage of writing submitted for logical-fallacy analysis.");
  const q = QUESTIONS.slippery_slope;
  assert.equal(q.type, "noul");
  assert.ok(q.instructions.startsWith("Does the reasoning in this text commit the 'Slippery slope' fallacy? Asserting that if we allow A"));
  assert.ok(q.instructions.includes(" Specifically: The text claims a modest first step"));
  assert.ok(q.instructions.endsWith("Merely naming, defining, quoting in order to criticise, or teaching about this fallacy does not count."));
  assert.deepEqual(q.criteria, { true: "The text commits the Slippery slope fallacy.", false: "The text does not commit the Slippery slope fallacy." });
});

test("payload names the excerpt when there are several", () => {
  assert.match(buildPayload("x", 1, 3).state.description, /This is excerpt 2 of 3 from a longer text/);
});

test("yesProbability reads noul, probability and probabilities, clamped", () => {
  assert.equal(yesProbability({ noul: 0.7 }), 0.7);
  assert.equal(yesProbability({ probability: "0.25" }), 0.25);
  assert.equal(yesProbability({ probabilities: { true: 0.9 } }), 0.9);
  assert.equal(yesProbability({ probabilities: { yes: 0.4 } }), 0.4);
  assert.equal(yesProbability({ noul: 3 }), 1);
  assert.equal(yesProbability({}), 0);
});

test("scoresFrom rounds to 0-100 and ignores unknown ids", () => {
  assert.deepEqual(scoresFrom({ answers: { strawman: { noul: 0.876 }, mystery: { noul: 1 }, bandwagon: "junk" } }), { strawman: 88 });
});

test("askJev sends the key and app headers and returns the body", async () => {
  const f = fakeFetch(answers({ strawman: 0.9 }));
  const r = await askJev(KEY, TEXT, 0, 1, { fetch: f, sleep: noSleep });
  assert.equal(r.answers.strawman.noul, 0.9);
  const c = f.calls[0];
  assert.equal(c.url, DECISIONS_URL);
  assert.equal(c.init.method, "POST");
  assert.equal(c.headers.Authorization, `Bearer ${KEY}`);
  assert.equal(c.headers["X-OpenRouter-Title"], "Fallacy Lens");
  assert.equal(c.headers["HTTP-Referer"], "https://github.com/cobmuddybug/fallacylens-extension");
});

test("askJev retries 429 using Retry-After, then succeeds", async () => {
  const waits = [];
  const ok = answers();
  const f = fakeFetch((call, n) => (n === 1 ? { status: 429, body: {}, headers: { "Retry-After": "3" } } : ok(call)));
  await askJev(KEY, TEXT, 0, 1, { fetch: f, sleep: async ms => waits.push(ms) });
  assert.equal(f.calls.length, 2);
  assert.deepEqual(waits, [3000]);
});

test("askJev gives up after 4 attempts on 500, backing off 2s, 4s, 6s", async () => {
  const waits = [];
  const f = fakeFetch(() => ({ status: 500, body: { error: { message: "boom" } } }));
  await assert.rejects(askJev(KEY, TEXT, 0, 1, { fetch: f, sleep: async ms => waits.push(ms) }),
    e => e instanceof JevError && e.status === 500 && /OpenRouter 500: boom/.test(e.message));
  assert.equal(f.calls.length, 4);
  assert.deepEqual(waits, [2000, 4000, 6000]);
});

for (const status of [400, 401, 402, 403]) {
  test(`askJev does not retry ${status}`, async () => {
    const f = fakeFetch(() => ({ status, body: { error: { message: "no" } } }));
    await assert.rejects(askJev(KEY, TEXT, 0, 1, { fetch: f, sleep: noSleep }), e => e.status === status && e.type === "http");
    assert.equal(f.calls.length, 1);
  });
}

test("askJev reports max_tokens_exceeded as its own type", async () => {
  const f = fakeFetch(() => ({ status: 400, body: { detail: { error_type: "max_tokens_exceeded" } } }));
  await assert.rejects(askJev(KEY, TEXT, 0, 1, { fetch: f, sleep: noSleep }), e => e.type === "max_tokens");
  assert.equal(f.calls.length, 1);
});

test("askJev retries a network error", async () => {
  const ok = answers();
  const f = fakeFetch((call, n) => { if (n === 1) throw new TypeError("fetch failed"); return ok(call); });
  await askJev(KEY, TEXT, 0, 1, { fetch: f, sleep: noSleep });
  assert.equal(f.calls.length, 2);
});

test("askJev flags a 200 without answers as a format change, without retrying", async () => {
  const f = fakeFetch(() => ({ body: { something: "else" } }));
  await assert.rejects(askJev(KEY, TEXT, 0, 1, { fetch: f, sleep: noSleep }), e => e.type === "format");
  assert.equal(f.calls.length, 1);
});

test("askJev stops when aborted", async () => {
  const ctrl = new AbortController();
  ctrl.abort();
  const f = fakeFetch(answers());
  await assert.rejects(askJev(KEY, TEXT, 0, 1, { fetch: f, signal: ctrl.signal, sleep: noSleep }), e => e.type === "aborted");
  assert.equal(f.calls.length, 0);
});

test("aggregate takes each fallacy's peak and sorts by score, then name", () => {
  const rows = aggregate([{ strawman: 40, bandwagon: 70 }, { strawman: 70, genetic: 10 }]);
  assert.equal(rows.length, 24);
  assert.deepEqual(rows.slice(0, 3).map(r => [r.id, r.score]), [["bandwagon", 70], ["strawman", 70], ["genetic", 10]]);
  assert.deepEqual(Object.keys(rows[0]).sort(), ["definition", "example", "id", "name", "score"]);
});

test("analyze: one chunk, sorted results, cost and progress", async () => {
  const progress = [];
  const f = fakeFetch(answers({ slippery_slope: 0.91, strawman: 0.5 }, 0.02, 0.0003));
  const r = await analyze(KEY, TEXT, { fetch: f, sleep: noSleep, onProgress: p => progress.push(p) });
  assert.equal(f.calls.length, 1);
  assert.deepEqual([r.analysed, r.total, r.errors.length], [1, 1, 0]);
  assert.equal(r.cost, 0.0003);
  assert.deepEqual(r.results.slice(0, 2).map(x => [x.id, x.score]), [["slippery_slope", 91], ["strawman", 50]]);
  assert.deepEqual(progress.at(0), { done: 0, total: 1 });
  assert.deepEqual(progress.at(-1), { done: 1, total: 1 });
});

test("analyze: the peak across chunks finds a fallacy in any part", async () => {
  const text = ["Calm paragraph one about gardens.", "Calm paragraph two about rivers.", "BAD paragraph about slopes."]
    .map(p => p.repeat(4)).join("\n\n");
  const f = fakeFetch(call => answers(record(call).includes("BAD") ? { slippery_slope: 0.9 } : { slippery_slope: 0.1 })(call));
  const r = await analyze(KEY, text, { fetch: f, sleep: noSleep, chunkChars: 150, overlap: 20 });
  assert.ok(r.total >= 3);
  assert.equal(r.results[0].id, "slippery_slope");
  assert.equal(r.results[0].score, 90);
});

test("analyze: max_tokens_exceeded halves a chunk until it fits", async () => {
  const text = "Sentence number one goes here. ".repeat(40).trim(); // ~1.2k chars
  const ok = answers({ ad_hominem: 0.8 });
  const f = fakeFetch(call => (record(call).length > 400
    ? { status: 400, body: { detail: { error_type: "max_tokens_exceeded" } } } : ok(call)));
  const r = await analyze(KEY, text, { fetch: f, sleep: noSleep, chunkChars: 5000, overlap: 30, minSplit: 100 });
  assert.equal(r.analysed, r.total);
  assert.ok(r.total >= 4);
  assert.equal(r.results[0].id, "ad_hominem");
});

test("analyze: a chunk too small to halve fails with max_tokens", async () => {
  const f = fakeFetch(() => ({ status: 400, body: { detail: { error_type: "max_tokens_exceeded" } } }));
  await assert.rejects(analyze(KEY, TEXT, { fetch: f, sleep: noSleep }), e => e.type === "max_tokens");
});

test("analyze: 401 stops the remaining chunks", async () => {
  const text = Array.from({ length: 5 }, (_, i) => `Paragraph ${i} `.repeat(10)).join("\n\n");
  const f = fakeFetch(() => ({ status: 401, body: { error: { message: "bad key" } } }));
  await assert.rejects(analyze(KEY, text, { fetch: f, sleep: noSleep, chunkChars: 150, overlap: 0, concurrency: 1 }), e => e.status === 401);
  assert.equal(f.calls.length, 1);
});

test("analyze: one failing chunk gives partial results", async () => {
  const text = ["First part here.", "FAIL second part.", "Third part here."].map(p => p.repeat(6)).join("\n\n");
  const ok = answers({ bandwagon: 0.6 });
  const f = fakeFetch(call => (record(call).includes("FAIL") && !record(call).startsWith("First")
    ? { status: 500, body: {} } : ok(call)));
  const r = await analyze(KEY, text, { fetch: f, sleep: noSleep, chunkChars: 120, overlap: 0 });
  assert.equal(r.total - r.analysed, 1);
  assert.equal(r.errors.length, 1);
  assert.equal(r.results[0].id, "bandwagon");
});

test("analyze: an outer abort rejects as aborted", async () => {
  const ctrl = new AbortController();
  const f = fakeFetch(async () => { ctrl.abort(); throw new DOMException("aborted", "AbortError"); });
  await assert.rejects(analyze(KEY, TEXT, { fetch: f, signal: ctrl.signal, sleep: noSleep }), e => e.type === "aborted");
});

test("askJev treats answers with no recognisable scores as a format change", async () => {
  for (const answersBody of [{}, { strawman: { value: 0.9 }, bandwagon: { score: 1 } }, { mystery: { noul: 0.5 } }]) {
    const f = fakeFetch(() => ({ body: { answers: answersBody } }));
    await assert.rejects(askJev(KEY, TEXT, 0, 1, { fetch: f, sleep: noSleep }), e => e.type === "format", JSON.stringify(answersBody));
    assert.equal(f.calls.length, 1);
  }
});

test("askJev times out a stalled request and retries it as a network error", async () => {
  const f = fakeFetch(call => new Promise((_, reject) => {
    call.init.signal.addEventListener("abort", () => reject(new DOMException("timed out", "TimeoutError")), { once: true });
  }));
  await assert.rejects(askJev(KEY, TEXT, 0, 1, { fetch: f, sleep: noSleep, retries: 2, timeoutMs: 30 }),
    e => e.type === "network" && /too long/.test(e.message));
  assert.equal(f.calls.length, 2);
});
