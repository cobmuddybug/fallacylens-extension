import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const SCRIPT = resolve(import.meta.dirname, "../../tools/check-secrets.sh");

// A scratch git repo holding a copy of the script plus one file with the given content.
function scratch(content) {
  const dir = mkdtempSync(join(tmpdir(), "fl-secrets-"));
  execFileSync("git", ["init", "-q"], { cwd: dir });
  mkdirSync(join(dir, "tools"));
  cpSync(SCRIPT, join(dir, "tools/check-secrets.sh"));
  writeFileSync(join(dir, "notes.txt"), content);
  execFileSync("git", ["add", "-A"], { cwd: dir });
  return dir;
}
const run = dir => spawnSync("sh", [join(dir, "tools/check-secrets.sh")], { encoding: "utf8" });

test("passes a clean tree", () => {
  const dir = scratch("Paste your key (it starts with sk-or-) on the options page.\n");
  try { assert.equal(run(dir).status, 0); } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("fails on an OpenRouter key", () => {
  const fake = "sk-or-v1-" + "ab".repeat(32); // built at runtime so this file never holds one
  const dir = scratch(`key = ${fake}\n`);
  try {
    const r = run(dir);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /possible credential/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("fails on a personal home path", () => {
  const dir = scratch(["see /", "home/", "someone/Projects/x"].join("") + "\n");
  try { assert.equal(run(dir).status, 1); } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("fails on a future OpenRouter key format", () => {
  const fake = "sk-or-v2-" + "Ab9".repeat(12);
  const dir = scratch(`key = ${fake}\n`);
  try { assert.equal(run(dir).status, 1); } finally { rmSync(dir, { recursive: true, force: true }); }
});
