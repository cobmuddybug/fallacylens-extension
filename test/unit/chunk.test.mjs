import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { chunkText, tail, halve } from "../../src/chunk.js";

const CASES = JSON.parse(readFileSync(new URL("../fixtures/chunks.json", import.meta.url), "utf8"));
const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;

for (const c of CASES) {
  test(`matches the desktop app: ${c.name}`, () => {
    assert.deepEqual(chunkText(c.text, c.size, c.overlap), c.chunks);
  });
}

test("short text is one chunk at the default size", () => {
  const text = "A short paragraph.\n\nAnd another one.";
  assert.deepEqual(chunkText(text), [{ text, start: 0, end: text.length }]);
});

test("default size keeps chunks within 100k plus overlap", () => {
  const para = "This sentence is here to fill space in the test. ".repeat(10).trim();
  const text = Array(500).fill(para).join("\n\n"); // ~245k chars
  const chunks = chunkText(text);
  assert.equal(chunks.length, 3);
  for (const ch of chunks) assert.ok(ch.end - ch.start <= 100_000);
  for (const ch of chunks.slice(1)) assert.ok(ch.text.length <= 100_000 + 600 + 2);
});

test("never splits a surrogate pair", () => {
  const text = "😀".repeat(300); // 600 UTF-16 units, no spaces: forces hard cuts
  const chunks = chunkText(text, 201, 61);
  assert.ok(chunks.length > 1);
  for (const ch of chunks) assert.ok(!LONE_SURROGATE.test(ch.text), JSON.stringify(ch.text.slice(0, 4)));
  assert.equal(chunks.map(ch => text.slice(ch.start, ch.end)).join(""), text);
});

test("tail starts at a sentence boundary, else a word boundary", () => {
  // Expected values computed with the desktop app's _tail.
  assert.equal(tail("Zero one two. Three four five six seven eight nine.", 40), "Three four five six seven eight nine.");
  assert.equal(tail("First one. Second one here. Third.", 22), "one here. Third.");
  assert.equal(tail("short", 10), "short");
});

test("halve prefers a paragraph break near the middle and carries overlap", () => {
  const a = "Alpha sentence. ".repeat(40).trim(), b = "Beta sentence. ".repeat(40).trim();
  const [first, second] = halve(`${a}\n\n${b}`, 50);
  assert.equal(first, a);
  assert.ok(second.endsWith(b));
  assert.ok(second.length > b.length, "second half starts with overlap from the first");
  assert.ok(second.startsWith(tail(a, 50)));
});

test("halve falls back to a space, then a hard cut, never splitting a pair", () => {
  const words = Array.from({ length: 200 }, (_, i) => `w${i}`).join(" ");
  const [x, y] = halve(words, 0);
  assert.ok(Math.abs(x.length - y.length) < words.length / 4);
  assert.equal(`${x} ${y}`, words);
  const [p, q] = halve("😀".repeat(101), 0);
  assert.ok(!LONE_SURROGATE.test(p) && !LONE_SURROGATE.test(q));
  assert.equal(p + q, "😀".repeat(101));
});
