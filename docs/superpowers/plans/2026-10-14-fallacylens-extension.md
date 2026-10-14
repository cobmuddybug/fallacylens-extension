# Fallacy Lens for Chrome Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Manifest V3 Chrome extension: right-click selected text, choose **Check for fallacies**, and a card beside the selection shows Jev's scores for 24 logical fallacies, each with a definition and an example.

**Architecture:**
- Pure ES modules (`config`, `fallacies`, `chunk`, `jev`, `errors`, `check`, `keys`) hold all logic and are unit-tested in Node against a fake `fetch`.
- A thin service worker (`background.js`) wires them to Chrome and is the only code that reads the key.
- A classic-script card (`card.js`) is injected into the page, or loaded by a popup window where injection isn't allowed. It talks to the worker over a port and only ever receives scores.
- An e2e suite drives headless Chromium over the DevTools protocol against a fake Jev server.

**Tech Stack:** Plain JavaScript (ES2022), Chrome MV3 APIs, `node --test` (Node ≥ 22, built-in `WebSocket`), Chromium for e2e, Python 3 only for the one-off fixture generator, `rsvg-convert` for icons, `zip`. No npm packages.

**Spec:** `docs/superpowers/specs/2026-10-14-fallacylens-extension-design.md`

## Global Constraints

- No runtime or dev dependencies: no `npm install`, no `node_modules`.
- Node ≥ 22. Tests run with `node --test`.
- Model `typesafe/jev-1.13`; endpoint `https://openrouter.ai/api/alpha/decisions`; key check `https://openrouter.ai/api/v1/key`.
- Headers: `Authorization: Bearer <key>`, `HTTP-Referer: https://github.com/cobmuddybug/fallacylens-extension`, `X-OpenRouter-Title: Fallacy Lens`.
- Chunking: 100,000 characters per chunk, 600-character overlap, halving never below 5,000 characters, 2 chunks in flight, 4 attempts per request, maximum selection 500,000 characters, minimum 15.
- Retried: 408, 409, 429, 499, 500, 502, 503, 504, and network errors. Backoff is `min(10, 2·attempt)` s, or `Retry-After` (capped at 30 s).
- Not retried: 400, 401, 402, 403. 401, 402 or 403 aborts the remaining chunks. 400 with `max_tokens_exceeded` halves the chunk instead.
- The key is stored only in `chrome.storage.local` under `key`, never `storage.sync`. The threshold is stored under `threshold` (30–80, default 50).
- Only `src/background.js` reads the key. Nothing sent to the card contains it.
- No credential, personal path (`/home/<user>/`, `/Users/<user>`) or personal email in any tracked file. Test keys are obviously fake (`sk-or-test-…`).
- Commits use the repo's configured identity and end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Makefile recipe lines are indented with a **tab**.
- The repo stays **private** on GitHub. Never change its visibility.

## Deviations from the spec (decided while planning)

- **No separate `card.css`.** The card's CSS lives in `card.js` as a string, applied with a constructable stylesheet. A strict page CSP would block both a `<style>` tag and a stylesheet fetched from the extension; constructable sheets aren't affected.
- **`package.json`** with `"type": "module"` and no dependencies, so Node treats `src/*.js` as ES modules.
- **Toolbar button.** An `action` with no popup: clicking the toolbar icon opens settings, so users can find them.
- **Wording:** "No fallacies scored T or more", because rows at exactly T are shown.
- **Test hook marker.** `card.js` contains a `/* e2e-log */` comment that the e2e build replaces with message logging. It's inert in the real build.

## File structure

```
manifest.json              MV3 manifest
package.json               {"type":"module"} so Node runs src/ as ESM; no dependencies
LICENSE, README.md
Makefile                   test, e2e, live, check-secrets, zip, fixtures, icons
icons/icon.svg + icon-{16,32,48,128}.png
src/config.js              endpoints, model, limits (the e2e build rewrites the URLs)
src/fallacies.js           the 24 fallacies {id, name, definition, guidance, example}
src/chunk.js               chunkText, halve, tail
src/jev.js                 JevError, buildPayload, scoresFrom, askJev, aggregate, analyze
src/errors.js              describeError: JevError → {kind, message} for the card
src/check.js               runCheck: validate, analyze, post messages to the card
src/keys.js                validateKey, keyHint, checkKey
src/background.js          service worker: menu, injection, popup fallback, port
src/card.js                the card (classic script)
src/popup-card.html        the card in a popup window
src/options.html, options.css, options.js
tools/check-secrets.sh     fails on credentials or personal paths in tracked files
tools/make_fixtures.py     writes test/fixtures/chunks.json from the desktop app
tools/samples.mjs          the 6 sample paragraphs with expected fallacies
tools/live.mjs             real-Jev smoke test and dilution probe
test/unit/*.test.mjs       node --test, offline
test/unit/fakefetch.mjs    fake fetch helpers
test/fixtures/chunks.json  generated
test/e2e/harness.mjs       Chromium launch, CDP client, fake Jev server, test build
test/e2e/card.test.mjs, test/e2e/options.test.mjs
```

## Review Focus

1. **Selection inside a `<textarea>` or text `<input>`.** `getSelection()` can be empty or lose line breaks there. Expected: the card checks the field's selected text with its line breaks intact. Tested in Task 5 (`textarea selection keeps line breaks`).
2. **A page with a strict Content-Security-Policy.** A `default-src 'none'` policy blocks inline styles. Expected: the card is still fully styled. Tested in Task 5 (`card is styled under a strict CSP`).
3. **A page Chrome won't let extensions script** (`chrome://` pages, the Web Store, the PDF viewer, cross-origin frames). Expected: a popup window shows the card instead of nothing happening. Tested in Task 5 (`restricted page falls back to a popup window`).
4. **Emoji or other astral characters at a cut point.** Expected: no chunk or overlap contains half a surrogate pair, which would send garbage to Jev. Tested in Task 2 (`never splits a surrogate pair`).
5. **A very narrow window or a high zoom level** (viewport under 356 px). Expected: the card shrinks to fit, with 8 px gutters and no horizontal overflow. Tested in Task 5 (`card fits a narrow viewport`).

---

### Task 1: Scaffold, config, fallacy list, secret check

**Files:**
- Create: `package.json`, `manifest.json`, `LICENSE`, `Makefile`, `src/config.js`, `src/fallacies.js`, `tools/check-secrets.sh`
- Test: `test/unit/fallacies.test.mjs`, `test/unit/check-secrets.test.mjs`

**Interfaces:**
- Produces:
  - `src/config.js` exports `MODEL`, `DECISIONS_URL`, `KEYCHECK_URL`, `REFERER`, `TITLE` (strings) and `CHUNK_CHARS=100000`, `OVERLAP_CHARS=600`, `MIN_SPLIT_CHARS=5000`, `CONCURRENCY=2`, `RETRIES=4`, `MAX_CHARS=500000`, `MIN_CHARS=15`.
  - `src/fallacies.js` exports `FALLACIES: Array<{id, name, definition, guidance, example}>` (24, in poster order) and `BY_ID: Record<id, entry>`.

- [ ] **Step 1: Write `package.json`, `LICENSE`, `manifest.json`**

`package.json`:
```json
{
  "name": "fallacylens-extension",
  "private": true,
  "type": "module",
  "description": "Chrome extension: right-click selected text to score it for 24 logical fallacies with Jev.",
  "license": "MIT"
}
```

`LICENSE`:
```
MIT License

Copyright (c) 2026 Cob Muddybug

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

`manifest.json`. The icons are created in Task 5; Chrome isn't loaded until then.
```json
{
  "manifest_version": 3,
  "name": "Fallacy Lens",
  "version": "0.1.0",
  "description": "Right-click selected text to check it for 24 common logical fallacies, scored by Jev. Bring your own OpenRouter key.",
  "minimum_chrome_version": "116",
  "permissions": ["contextMenus", "storage", "activeTab", "scripting"],
  "host_permissions": ["https://openrouter.ai/*"],
  "background": { "service_worker": "src/background.js", "type": "module" },
  "options_ui": { "page": "src/options.html", "open_in_tab": true },
  "action": { "default_title": "Fallacy Lens settings" },
  "icons": { "16": "icons/icon-16.png", "32": "icons/icon-32.png", "48": "icons/icon-48.png", "128": "icons/icon-128.png" }
}
```

- [ ] **Step 2: Write `src/config.js`**

```js
// Everything that talks to the outside world, and the limits that shape a check.
// The e2e test build rewrites the two URLs to point at a local fake; nothing else may.

export const MODEL = "typesafe/jev-1.13";
export const DECISIONS_URL = "https://openrouter.ai/api/alpha/decisions";
export const KEYCHECK_URL = "https://openrouter.ai/api/v1/key";
export const REFERER = "https://github.com/cobmuddybug/fallacylens-extension";
export const TITLE = "Fallacy Lens";

export const CHUNK_CHARS = 100_000;   // measured 2026-10-14: one fallacious sentence in 120k chars still scores ~83
export const OVERLAP_CHARS = 600;     // carried into the next chunk so an argument straddling a cut is seen whole
export const MIN_SPLIT_CHARS = 5_000; // max_tokens_exceeded halves a chunk, but never below this
export const CONCURRENCY = 2;
export const RETRIES = 4;
export const MAX_CHARS = 500_000;
export const MIN_CHARS = 15;
```

- [ ] **Step 3: Write the failing fallacies test**

`test/unit/fallacies.test.mjs`:
```js
import test from "node:test";
import assert from "node:assert/strict";
import { FALLACIES, BY_ID } from "../../src/fallacies.js";

const POSTER_ORDER = [
  "strawman", "false_cause", "appeal_to_emotion", "fallacy_fallacy", "slippery_slope", "ad_hominem",
  "tu_quoque", "personal_incredulity", "special_pleading", "loaded_question", "burden_of_proof",
  "ambiguity", "gamblers_fallacy", "bandwagon", "appeal_to_authority", "composition_division",
  "no_true_scotsman", "genetic", "black_or_white", "begging_the_question", "appeal_to_nature",
  "anecdotal", "texas_sharpshooter", "middle_ground",
];

test("24 fallacies in poster order", () => {
  assert.deepEqual(FALLACIES.map(f => f.id), POSTER_ORDER);
});

test("every fallacy has every field filled in", () => {
  for (const f of FALLACIES) {
    for (const field of ["id", "name", "definition", "guidance", "example"]) {
      assert.ok(typeof f[field] === "string" && f[field].trim().length > 3, `${f.id}.${field}`);
    }
    assert.ok(!/^e\.g\./i.test(f.example), `${f.id}.example should not start with e.g. (the card adds it)`);
  }
});

test("BY_ID indexes every fallacy", () => {
  assert.equal(Object.keys(BY_ID).length, 24);
  assert.equal(BY_ID.slippery_slope.name, "Slippery slope");
});
```

- [ ] **Step 4: Run it and see it fail**

Run: `node --test test/unit/fallacies.test.mjs`
Expected: FAIL with `Cannot find module …/src/fallacies.js`.

- [ ] **Step 5: Write `src/fallacies.js`**

The definitions and guidance are copied from the desktop app. The examples are new.
```js
// The 24 fallacies from the "thou shalt not commit logical fallacies" poster.
// definition: shown in the card. guidance: extra detail for Jev. example: shown in the card.
// Definitions and guidance come from the Fallacy Lens desktop app; the examples are original.

export const FALLACIES = [
  {
    id: "strawman", name: "Strawman",
    definition: "Misrepresenting someone's argument to make it easier to attack.",
    guidance: "The text restates an opposing position in a distorted, exaggerated or oversimplified form and then attacks that distorted version instead of the position actually held.",
    example: "Senator Lee wants a modest cut to the defense budget, so apparently she wants to leave the country defenseless.",
  },
  {
    id: "false_cause", name: "False cause",
    definition: "Presuming that a real or perceived relationship between things means one causes the other.",
    guidance: "The text infers causation from correlation, coincidence or mere sequence in time (post hoc) without justification.",
    example: "I started wearing my lucky socks and the team won three games straight, so the socks are clearly helping.",
  },
  {
    id: "appeal_to_emotion", name: "Appeal to emotion",
    definition: "Manipulating an emotional response in place of a valid or compelling argument.",
    guidance: "The text tries to win agreement by provoking pity, fear, guilt, outrage or similar feelings where reasons or evidence are needed.",
    example: "If you really loved your kids, you wouldn't even ask whether this expensive car seat is any safer.",
  },
  {
    id: "fallacy_fallacy", name: "The fallacy fallacy",
    definition: "Presuming that because a claim was poorly argued, or argued with a fallacy, it must be wrong.",
    guidance: "The text concludes a claim is false because someone defended it badly or committed a fallacy while arguing for it.",
    example: "Your case for recycling leaned on an appeal to emotion, so recycling obviously doesn't help.",
  },
  {
    id: "slippery_slope", name: "Slippery slope",
    definition: "Asserting that if we allow A, then Z will follow, therefore A should not happen.",
    guidance: "The text claims a modest first step will inevitably lead through a chain of events to an extreme outcome, without showing the chain is likely.",
    example: "If we let students redo one test, soon nobody will study for anything at all.",
  },
  {
    id: "ad_hominem", name: "Ad hominem",
    definition: "Attacking an opponent's character or personal traits to undermine their argument.",
    guidance: "The text dismisses an argument by attacking the person making it (character, history, motives, appearance) rather than the argument itself.",
    example: "Why listen to his views on tax policy? He's been divorced twice.",
  },
  {
    id: "tu_quoque", name: "Tu quoque",
    definition: "Avoiding criticism by turning it back on the accuser.",
    guidance: "The text answers a criticism by accusing the critic of the same or a similar fault (\"you do it too\") instead of addressing the criticism.",
    example: "You're telling me not to speed? I've watched you drive over the limit plenty of times.",
  },
  {
    id: "personal_incredulity", name: "Personal incredulity",
    definition: "Saying that because something is hard to understand or imagine, it must be untrue.",
    guidance: "The text rejects a claim mainly because the author finds it difficult to understand, unbelievable or counterintuitive.",
    example: "I can't see how something as heavy as a jumbo jet stays in the air, so the official explanation must be wrong.",
  },
  {
    id: "special_pleading", name: "Special pleading",
    definition: "Moving the goalposts or inventing an exception when a claim is shown to be false.",
    guidance: "The text exempts a favoured claim or case from a rule or standard applied elsewhere, or adds ad hoc excuses after the claim fails a test.",
    example: "My psychic powers failed the lab test only because the skeptics in the room gave off negative energy.",
  },
  {
    id: "loaded_question", name: "Loaded question",
    definition: "Asking a question with an unjustified assumption built in, so it can't be answered without appearing guilty.",
    guidance: "The text poses a question that presupposes something contentious or damaging (e.g. \"have you stopped cheating?\").",
    example: "Have you stopped wasting the company's money on pointless meetings yet?",
  },
  {
    id: "burden_of_proof", name: "Burden of proof",
    definition: "Saying the burden of proof lies with someone else to disprove a claim, not with the claimant.",
    guidance: "The text treats a claim as valid because nobody has disproved it, or demands that others disprove it rather than supporting it.",
    example: "Nobody has proven this house isn't haunted, so it's reasonable to believe it is.",
  },
  {
    id: "ambiguity", name: "Ambiguity",
    definition: "Using double meanings or ambiguous language to mislead or misrepresent the truth.",
    guidance: "The text relies on a word or phrase with more than one meaning, or on vague wording, shifting between senses (equivocation) to reach its conclusion or mislead.",
    example: "The sign said \"fine for parking here,\" so I took it to mean parking here was fine.",
  },
  {
    id: "gamblers_fallacy", name: "The gambler's fallacy",
    definition: "Believing that 'runs' occur in statistically independent events such as roulette spins.",
    guidance: "The text assumes past outcomes of independent random events change the odds of future ones (\"it's due\").",
    example: "The coin has landed heads six times in a row, so tails is bound to come up next.",
  },
  {
    id: "bandwagon", name: "Bandwagon",
    definition: "Appealing to popularity, or the fact that many people do something, as validation.",
    guidance: "The text argues a claim is true or a choice right because many or most people believe or do it.",
    example: "Millions of people swear by this diet, so it must be the healthiest way to eat.",
  },
  {
    id: "appeal_to_authority", name: "Appeal to authority",
    definition: "Using an authority's opinion or position in place of an actual argument.",
    guidance: "The text treats a claim as settled because an authority, expert, celebrity or institution endorses it, especially an authority outside their field, instead of giving reasons or evidence.",
    example: "A famous actor says this cryptocurrency is the future of money, so it's a safe investment.",
  },
  {
    id: "composition_division", name: "Composition / division",
    definition: "Assuming what's true of a part applies to the whole, or what's true of the whole applies to its parts.",
    guidance: "The text infers a property of a whole from its parts (composition) or of a part from the whole (division) where that inference does not hold.",
    example: "Every player on this team is an all-star, so the team is sure to be the best in the league.",
  },
  {
    id: "no_true_scotsman", name: "No true Scotsman",
    definition: "Appealing to purity to dismiss relevant criticisms or flaws of an argument.",
    guidance: "The text responds to a counterexample by redefining the group so the counterexample doesn't count (\"no real X would do that\").",
    example: "Dave left the game early? Then he's not a real fan, because no real fan would ever do that.",
  },
  {
    id: "genetic", name: "Genetic",
    definition: "Judging something good or bad on the basis of where, or whom, it comes from.",
    guidance: "The text accepts or rejects a claim because of its origin or source (a group, outlet, era, person) rather than its merits.",
    example: "That idea first appeared in a tabloid, so there's no point even considering it.",
  },
  {
    id: "black_or_white", name: "Black-or-white",
    definition: "Presenting two alternatives as the only possibilities when more exist.",
    guidance: "The text presents a false dilemma: only two options are offered, typically one clearly bad, while other reasonable options are ignored.",
    example: "Either you support every part of this bill, or you don't care about the environment.",
  },
  {
    id: "begging_the_question", name: "Begging the question",
    definition: "A circular argument in which the conclusion is included in the premise.",
    guidance: "The text's argument assumes its own conclusion: a premise restates or depends on the very thing being argued for.",
    example: "He's a reliable source, because everything he says is true.",
  },
  {
    id: "appeal_to_nature", name: "Appeal to nature",
    definition: "Arguing that because something is 'natural' it is valid, justified, good or ideal.",
    guidance: "The text argues something is good, safe or right because it is natural, or bad because it is unnatural or artificial.",
    example: "These wild berries are completely natural, so they can't possibly make you sick.",
  },
  {
    id: "anecdotal", name: "Anecdotal",
    definition: "Using personal experience or an isolated example instead of a valid argument.",
    guidance: "The text relies on a personal story or a single example as proof of a general claim, often to dismiss statistical or systematic evidence.",
    example: "My grandfather smoked a pack a day and lived to 95, so smoking can't be that bad for you.",
  },
  {
    id: "texas_sharpshooter", name: "The Texas sharpshooter",
    definition: "Cherry-picking data clusters to suit an argument, or finding a pattern to fit a presumption.",
    guidance: "The text selects only the data points that fit its conclusion, or draws a pattern around coincidental clusters after the fact, ignoring contrary data.",
    example: "Of all the towns along the power line, look at these five with high cancer rates: the line must be causing it.",
  },
  {
    id: "middle_ground", name: "Middle ground",
    definition: "Saying a compromise, or middle point, between two extremes must be the truth.",
    guidance: "The text concludes that the truth or right answer lies between two positions merely because it is a compromise between them.",
    example: "One engineer says the bridge is safe and another says it will collapse, so it's probably a little unsafe.",
  },
];

export const BY_ID = Object.fromEntries(FALLACIES.map(f => [f.id, f]));
```

- [ ] **Step 6: Run it and see it pass**

Run: `node --test test/unit/fallacies.test.mjs`
Expected: PASS, 3 tests.

- [ ] **Step 7: Write the failing secret-check test**

`test/unit/check-secrets.test.mjs`:
```js
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
```

- [ ] **Step 8: Run it and see it fail**

Run: `node --test test/unit/check-secrets.test.mjs`
Expected: FAIL, since `tools/check-secrets.sh` doesn't exist and `cpSync` throws ENOENT.

- [ ] **Step 9: Write `tools/check-secrets.sh` and make it executable**

```sh
#!/bin/sh
# Fail if any git-tracked file looks like it holds a credential or a personal path.
# Run before every push: make check-secrets
set -eu
cd "$(dirname "$0")/.."
pattern='sk-or-v1-[0-9a-f]{16,}|gh[pousr]_[A-Za-z0-9]{30,}|\b[0-9a-f]{40,}\b|/home/[a-z_][a-z0-9_-]*/|/Users/[A-Za-z]'
if git ls-files -z | xargs -0 grep -nIE "$pattern" --; then
  echo "check-secrets: possible credential or personal path above; remove it before pushing." >&2
  exit 1
fi
echo "check-secrets: clean"
```
Run: `chmod +x tools/check-secrets.sh`

- [ ] **Step 10: Run it and see it pass**

Run: `node --test test/unit/check-secrets.test.mjs`
Expected: PASS, 3 tests.

- [ ] **Step 11: Write the `Makefile`**

Recipe lines start with a tab.
```make
FALLACYLENS_APP ?= ../fallacylens/fallacylens
CHROMIUM ?= chromium
VERSION := $(shell node -p "JSON.parse(require('fs').readFileSync('manifest.json','utf8')).version")

.PHONY: test e2e live check-secrets zip fixtures icons

test:
	node --test 'test/unit/*.test.mjs'

e2e:
	CHROMIUM=$(CHROMIUM) node --test --test-concurrency=1 'test/e2e/*.test.mjs'

live:
	node tools/live.mjs

check-secrets:
	sh tools/check-secrets.sh

zip:
	rm -rf dist && mkdir -p dist
	zip -qr dist/fallacylens-extension-$(VERSION).zip manifest.json src icons -x 'icons/*.svg'
	unzip -l dist/fallacylens-extension-$(VERSION).zip

fixtures:
	python3 tools/make_fixtures.py $(FALLACYLENS_APP)

icons:
	for s in 16 32 48 128; do rsvg-convert -w $$s -h $$s icons/icon.svg -o icons/icon-$$s.png; done
```

- [ ] **Step 12: Run the whole unit suite and the secret check**

Run: `make test && make check-secrets`
Expected: 6 tests pass, then `check-secrets: clean`.

- [ ] **Step 13: Commit**

```bash
git add package.json manifest.json LICENSE Makefile src/config.js src/fallacies.js tools/check-secrets.sh test/unit
git commit -m "Scaffold extension: config, the 24 fallacies, secret check

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Chunking, ported and pinned to the desktop app

**Files:**
- Create: `src/chunk.js`, `tools/make_fixtures.py`, `test/fixtures/chunks.json` (generated)
- Test: `test/unit/chunk.test.mjs`

**Interfaces:**
- Consumes: `CHUNK_CHARS`, `OVERLAP_CHARS` from `src/config.js`.
- Produces:
  - `chunkText(text: string, size = CHUNK_CHARS, overlap = OVERLAP_CHARS): Array<{text, start, end}>`, where start/end are UTF-16 offsets of the chunk's own material.
  - `tail(text: string, n: number): string`
  - `halve(text: string, overlap = OVERLAP_CHARS): [string, string]`

- [ ] **Step 1: Write the fixture generator**

`tools/make_fixtures.py`:
```python
#!/usr/bin/env python3
"""Write test/fixtures/chunks.json from the Fallacy Lens desktop app's chunk_text, so the JS port in
src/chunk.js can be checked against the original.

Usage: python3 tools/make_fixtures.py path/to/fallacylens   (the desktop app's main script)
"""
import importlib.machinery
import importlib.util
import json
import sys
from pathlib import Path


def load(path):
    loader = importlib.machinery.SourceFileLoader("fallacylens_app", path)
    spec = importlib.util.spec_from_loader("fallacylens_app", loader)
    mod = importlib.util.module_from_spec(spec)
    loader.exec_module(mod)
    return mod


# ASCII and BMP characters only: Python offsets count code points and JS offsets count UTF-16 units,
# which agree only below U+10000. Astral characters are covered by a JS-only test.
CASES = [
    ("single", "One short paragraph that fits easily.", 200, 60),
    ("paragraphs", "\n\n".join(f"Paragraph {i} talks about topic {i} at a modest length for testing purposes."
                               for i in range(8)), 200, 60),
    ("long-paragraph", "".join(f"Sentence {i} is part of one long paragraph. " for i in range(20)).strip(), 200, 60),
    ("questions-and-quotes", " ".join(['He asked, "Is this right?" She said no.', "Wait… really?",
                                       "(It was.)", "They left!"] * 12), 150, 40),
    ("long-sentence", " ".join(f"word{i}" for i in range(150)), 200, 60),
    ("no-spaces", "~" * 500, 200, 60),
    ("crlf", "\r\n\r\n".join(f"Line paragraph {i} uses Windows line endings here." for i in range(8)), 150, 40),
    ("messy-whitespace", "\n\n   First paragraph.  \n\n\n\t Second paragraph has tabs.\t\n\n \n Third.   \n", 30, 10),
    ("empty", "", 200, 60),
    ("blank", "  \n\n \t ", 200, 60),
]


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    app = load(sys.argv[1])
    out = [{"name": name, "size": size, "overlap": overlap, "text": text,
            "chunks": app.chunk_text(text, size=size, overlap=overlap)}
           for name, text, size, overlap in CASES]
    dest = Path(__file__).resolve().parent.parent / "test/fixtures/chunks.json"
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(json.dumps(out, indent=1, ensure_ascii=False) + "\n")
    print(f"wrote {len(out)} cases to {dest.relative_to(Path.cwd()) if dest.is_relative_to(Path.cwd()) else dest}")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Generate the fixtures**

Run: `make fixtures`, which uses `../fallacylens/fallacylens`. Use `make fixtures FALLACYLENS_APP=<path>` if the app lives elsewhere.
Expected: `wrote 10 cases to test/fixtures/chunks.json`. Check that the file holds no absolute paths: `make check-secrets` → clean.

- [ ] **Step 3: Write the failing chunk tests**

`test/unit/chunk.test.mjs`:
```js
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
```

- [ ] **Step 4: Run them and see them fail**

Run: `node --test test/unit/chunk.test.mjs`
Expected: FAIL with `Cannot find module …/src/chunk.js`.

- [ ] **Step 5: Write `src/chunk.js`**

```js
// Split long text into overlapping chunks for Jev. Ported from the Fallacy Lens desktop app's
// chunk_text; test/fixtures/chunks.json pins the two to the same output.

import { CHUNK_CHARS, OVERLAP_CHARS } from "./config.js";

const SENTENCE_END = /(?<=[.!?…])["')\]]*\s+/g;
const PARAGRAPH = /\S(?:[\s\S]*?\S)?(?=\s*\n\s*\n|\s*$)/g;

const isLowSurrogate = c => c >= 0xdc00 && c <= 0xdfff;
// Never cut between the two halves of an emoji or other astral character.
const safeCut = (text, i) => (i > 0 && i < text.length && isLowSurrogate(text.charCodeAt(i)) ? i - 1 : i);

/** [start, end] spans of paragraphs, with any paragraph longer than `size` broken at sentence ends,
 *  then at spaces, then hard-cut. */
function spans(text, size) {
  const out = [];
  for (const para of text.matchAll(PARAGRAPH)) {
    const s = para.index, e = s + para[0].length;
    if (e - s <= size) {
      out.push([s, e]);
      continue;
    }
    const cuts = [s];
    for (const m of text.slice(s, e).matchAll(SENTENCE_END)) cuts.push(s + m.index + m[0].length);
    cuts.push(e);
    for (let k = 0; k + 1 < cuts.length; k++) {
      let a = cuts[k];
      const b = cuts[k + 1];
      while (b - a > size) {
        let sp = text.lastIndexOf(" ", a + size - 1);
        if (sp < a) sp = -1;
        const cut = sp > a + Math.floor(size / 2) ? sp : safeCut(text, a + size);
        out.push([a, cut]);
        a = cut;
        while (a < b && /\s/.test(text[a])) a++;
      }
      if (b > a) out.push([a, b]);
    }
  }
  return out;
}

/** The last ~n characters of text, starting at a sentence or word boundary. */
export function tail(text, n) {
  if (text.length <= n) return text;
  let t = text.slice(-n);
  if (isLowSurrogate(t.charCodeAt(0))) t = t.slice(1);
  const m = new RegExp(SENTENCE_END.source).exec(t);
  if (m && m.index + m[0].length < t.length * 0.7) return t.slice(m.index + m[0].length);
  const sp = t.indexOf(" ");
  return sp >= 0 && sp < Math.floor(t.length / 2) ? t.slice(sp + 1) : t;
}

/** Split text into chunks of at most ~size characters, each prefixed with the last ~overlap
 *  characters of the chunk before. start/end locate the chunk's own material in text. */
export function chunkText(text, size = CHUNK_CHARS, overlap = OVERLAP_CHARS) {
  const groups = [];
  for (const [s, e] of spans(text, size)) {
    const last = groups[groups.length - 1];
    if (last && e - last[0] > size) groups.push([s, e]);
    else if (last) last[1] = e;
    else groups.push([s, e]);
  }
  return groups.map(([s, e], i) => {
    const body = text.slice(s, e);
    const lead = i ? tail(text.slice(groups[i - 1][0], groups[i - 1][1]), overlap) : "";
    return { text: lead ? `${lead}\n\n${body}` : body, start: s, end: e };
  });
}

/** Split one chunk in two near its middle (for max_tokens_exceeded), preferring a paragraph break,
 *  then a sentence end, then a space. The second half starts with the tail of the first. */
export function halve(text, overlap = OVERLAP_CHARS) {
  const mid = Math.floor(text.length / 2), reach = Math.floor(text.length / 4);
  const nearest = re => {
    let best = -1;
    for (const m of text.matchAll(re)) {
      const at = m.index + m[0].length;
      if (Math.abs(at - mid) <= reach && (best < 0 || Math.abs(at - mid) < Math.abs(best - mid))) best = at;
    }
    return best;
  };
  let cut = nearest(/\n\s*\n/g);
  if (cut < 0) cut = nearest(SENTENCE_END);
  if (cut < 0) cut = nearest(/ +/g);
  if (cut < 0) cut = safeCut(text, mid);
  const first = text.slice(0, cut).trimEnd(), second = text.slice(cut).trimStart();
  const lead = overlap > 0 ? tail(first, overlap) : "";
  return [first, lead ? `${lead}\n\n${second}` : second];
}
```

- [ ] **Step 6: Run them and see them pass**

Run: `node --test test/unit/chunk.test.mjs`
Expected: PASS: 10 fixture cases plus 6 others. If a fixture case fails, diff the JSON. The port must match Python exactly, so fix `chunk.js`, never the fixture.

- [ ] **Step 7: Commit**

```bash
git add src/chunk.js tools/make_fixtures.py test/fixtures/chunks.json test/unit/chunk.test.mjs
git commit -m "Port chunking from the desktop app, pinned by generated fixtures

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Jev client and analysis

**Files:**
- Create: `src/jev.js`
- Test: `test/unit/fakefetch.mjs`, `test/unit/jev.test.mjs`

**Interfaces:**
- Consumes: `src/config.js` constants; `FALLACIES` and `BY_ID`; `chunkText` and `halve`.
- Produces:
  - `class JevError extends Error { status: number; type: "http"|"network"|"format"|"max_tokens"|"aborted" }`
  - `QUESTIONS: Record<id, {type:"noul", instructions, criteria}>`
  - `buildPayload(text, index, total) → object`
  - `yesProbability(answer) → number in [0,1]`
  - `scoresFrom(response) → Record<id, 0..100>`
  - `askJev(key, text, index, total, {fetch, signal?, sleep?, retries?}) → Promise<response>`
  - `aggregate(perChunk: Record<id,number>[]) → Row[]`, where Row is `{id, name, definition, example, score}`, sorted by score descending with ties broken by name
  - `analyze(key, text, {fetch, signal?, sleep?, onProgress?, chunkChars?, overlap?, minSplit?, concurrency?}) → Promise<{results: Row[], analysed, total, cost, errors: JevError[]}>`. It throws a `JevError` when nothing could be analysed.

- [ ] **Step 1: Write the fake fetch helpers**

`test/unit/fakefetch.mjs`:
```js
// A stand-in for fetch: handler(call, n) returns {status, body, headers} or a Response, or throws.
export function fakeFetch(handler) {
  const calls = [];
  const f = async (url, init = {}) => {
    if (init.signal?.aborted) throw new DOMException("aborted", "AbortError");
    const call = { url, init, body: init.body ? JSON.parse(init.body) : null, headers: init.headers || {} };
    calls.push(call);
    const r = await handler(call, calls.length);
    if (r instanceof Response) return r;
    return new Response(JSON.stringify(r.body ?? {}), { status: r.status ?? 200, headers: r.headers });
  };
  f.calls = calls;
  return f;
}

/** A 200 response scoring the given fallacies (0..1); unlisted ones get `rest`. */
export function answers(scores = {}, rest = 0.02, cost = 0.0002) {
  return (call) => {
    const out = {};
    for (const id of Object.keys(call.body.questions)) out[id] = { noul: scores[id] ?? rest };
    return { body: { answers: out, usage: { cost } } };
  };
}

export const noSleep = async () => {};
export const record = call => call.body.state.records[0].record;
```

- [ ] **Step 2: Write the failing Jev tests**

`test/unit/jev.test.mjs`:
```js
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
```

- [ ] **Step 3: Run them and see them fail**

Run: `node --test test/unit/jev.test.mjs`
Expected: FAIL with `Cannot find module …/src/jev.js`.

- [ ] **Step 4: Write `src/jev.js`**

```js
// Ask Jev (through OpenRouter's decisions API) whether a text commits each of the 24 fallacies.
// One request per chunk carries all 24 yes/no questions; a fallacy's score is its peak across chunks.

import { FALLACIES, BY_ID } from "./fallacies.js";
import { chunkText, halve } from "./chunk.js";
import {
  MODEL, DECISIONS_URL, REFERER, TITLE, CHUNK_CHARS, OVERLAP_CHARS, MIN_SPLIT_CHARS, CONCURRENCY, RETRIES,
} from "./config.js";

export class JevError extends Error {
  /** type: http | network | format | max_tokens | aborted */
  constructor(message, { status = 0, type = "http" } = {}) {
    super(message);
    this.name = "JevError";
    this.status = status;
    this.type = type;
  }
}

const aborted = () => new JevError("cancelled", { type: "aborted" });

function question(f) {
  return {
    type: "noul",
    instructions:
      `Does the reasoning in this text commit the '${f.name}' fallacy? ${f.definition} Specifically: ${f.guidance} ` +
      "Judge the arguments the text actually makes, including those it puts in the mouths of speakers " +
      "it presents approvingly. Merely naming, defining, quoting in order to criticise, or teaching " +
      "about this fallacy does not count.",
    criteria: {
      true: `The text commits the ${f.name} fallacy.`,
      false: `The text does not commit the ${f.name} fallacy.`,
    },
  };
}

export const QUESTIONS = Object.fromEntries(FALLACIES.map(f => [f.id, question(f)]));

export function buildPayload(text, index, total) {
  const where = total === 1 ? "" :
    ` This is excerpt ${index + 1} of ${total} from a longer text; it may begin with a little overlap ` +
    "from the previous excerpt. Judge only the reasoning visible in this excerpt.";
  return {
    model: MODEL,
    state: {
      description: "A passage of writing submitted for logical-fallacy analysis." + where,
      records: [{ id: "text", record: text }],
    },
    questions: QUESTIONS,
  };
}

const clamp01 = v => Math.max(0, Math.min(1, v));

export function yesProbability(answer) {
  for (const k of ["noul", "probability"]) {
    const v = Number(answer?.[k]);
    if (answer?.[k] != null && Number.isFinite(v)) return clamp01(v);
  }
  const probs = answer?.probabilities;
  if (probs && typeof probs === "object") {
    const v = Number(probs.true ?? probs.yes);
    if (Number.isFinite(v)) return clamp01(v);
  }
  return 0;
}

/** {fallacy id: 0-100} from one Jev response; unanswered questions are left out. */
export function scoresFrom(response) {
  const out = {};
  for (const [id, ans] of Object.entries(response?.answers ?? {})) {
    if (BY_ID[id] && ans && typeof ans === "object") out[id] = Math.round(yesProbability(ans) * 100);
  }
  return out;
}

const RETRYABLE = new Set([408, 409, 429, 499, 500, 502, 503, 504]);

function realSleep(ms, signal) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => { clearTimeout(t); reject(aborted()); }, { once: true });
  });
}

function errorDetail(data, raw) {
  const d = data?.detail ?? data?.error ?? {};
  return {
    type: typeof d === "object" ? d.error_type ?? "" : "",
    message: String((typeof d === "object" ? d.message ?? d.error_type : d) || raw || "no detail"),
  };
}

export async function askJev(key, text, index, total, { fetch, signal, sleep = realSleep, retries = RETRIES } = {}) {
  const body = JSON.stringify(buildPayload(text, index, total));
  let last;
  for (let attempt = 1; attempt <= retries; attempt++) {
    if (signal?.aborted) throw aborted();
    let res = null, wait = Math.min(10, 2 * attempt) * 1000;
    try {
      res = await fetch(DECISIONS_URL, {
        method: "POST", body, signal,
        headers: {
          Authorization: `Bearer ${key}`, "Content-Type": "application/json",
          "HTTP-Referer": REFERER, "X-OpenRouter-Title": TITLE,
        },
      });
    } catch (e) {
      if (signal?.aborted || e?.name === "AbortError") throw aborted();
      last = new JevError(`could not reach OpenRouter: ${e?.message ?? e}`, { type: "network" });
    }
    if (res) {
      const raw = await res.text().catch(() => "");
      let data = null;
      try { data = JSON.parse(raw); } catch { /* not JSON */ }
      if (res.ok) {
        if (!data || typeof data.answers !== "object" || data.answers === null) {
          throw new JevError(`Jev returned no answers: ${raw.slice(0, 300)}`, { status: res.status, type: "format" });
        }
        return data;
      }
      const d = errorDetail(data, raw);
      if (res.status === 400 && d.type === "max_tokens_exceeded") {
        throw new JevError("text too long for one request", { status: 400, type: "max_tokens" });
      }
      last = new JevError(`OpenRouter ${res.status}: ${d.message.slice(0, 400)}`, { status: res.status });
      if (!RETRYABLE.has(res.status)) throw last;
      const after = Number(res.headers.get("retry-after"));
      if (Number.isFinite(after) && after > 0) wait = Math.min(after, 30) * 1000;
    }
    if (attempt < retries) await sleep(wait, signal);
  }
  throw last;
}

/** Combine per-chunk scores: a fallacy's score is its peak (one clear instance is enough). */
export function aggregate(perChunk) {
  return FALLACIES.map(f => ({
    id: f.id, name: f.name, definition: f.definition, example: f.example,
    score: Math.max(0, ...perChunk.map(c => c[f.id] ?? 0)),
  })).sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
}

function limiter(n) {
  let active = 0;
  const waiting = [];
  return async fn => {
    if (active >= n) await new Promise(r => waiting.push(r));
    active++;
    try { return await fn(); } finally { active--; waiting.shift()?.(); }
  };
}

export async function analyze(key, text, {
  fetch, signal, sleep, onProgress = () => {},
  chunkChars = CHUNK_CHARS, overlap = OVERLAP_CHARS, minSplit = MIN_SPLIT_CHARS, concurrency = CONCURRENCY,
} = {}) {
  const pieces = chunkText(text, chunkChars, overlap).map(c => c.text);
  const inner = new AbortController();
  const stop = () => inner.abort();
  if (signal?.aborted) stop();
  signal?.addEventListener("abort", stop, { once: true });

  const scores = [], errors = [];
  let total = pieces.length, done = 0, cost = 0, seq = 0, fatal = null;
  const limit = limiter(concurrency);
  const progress = () => onProgress({ done, total });

  async function run(piece) {
    let resp;
    try {
      resp = await limit(() => {
        if (inner.signal.aborted) throw aborted();
        return askJev(key, piece, Math.min(seq++, total - 1), total, { fetch, signal: inner.signal, sleep });
      });
    } catch (e) {
      if (e.type === "max_tokens" && piece.length >= 2 * minSplit) {
        total += 1; // one piece becomes two
        progress();
        await Promise.all(halve(piece, overlap).map(run));
        return;
      }
      if (e.type === "aborted") return;
      errors.push(e);
      done++;
      if ([401, 402, 403].includes(e.status) && !fatal) { fatal = e; stop(); }
      progress();
      return;
    }
    scores.push(scoresFrom(resp));
    cost += Number(resp.usage?.cost) || 0;
    done++;
    progress();
  }

  progress();
  try {
    await Promise.all(pieces.map(run));
  } finally {
    signal?.removeEventListener("abort", stop);
  }
  if (signal?.aborted) throw aborted();
  if (!scores.length) throw fatal ?? errors[0] ?? new JevError("nothing to analyse", { type: "format" });
  return { results: aggregate(scores), analysed: scores.length, total, cost, errors };
}
```

- [ ] **Step 5: Run them and see them pass**

Run: `node --test test/unit/jev.test.mjs`
Expected: PASS, all tests. If "one failing chunk gives partial results" fails, print `f.calls.map(record)` to check how the 120-char chunks fell; adjust only the test text so exactly one chunk contains `FAIL` outside its overlap.

- [ ] **Step 6: Commit**

```bash
git add src/jev.js test/unit/fakefetch.mjs test/unit/jev.test.mjs
git commit -m "Add Jev client: payload, retries, halving, peak aggregation

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Error messages, the check runner, key helpers

**Files:**
- Create: `src/errors.js`, `src/check.js`, `src/keys.js`
- Test: `test/unit/check.test.mjs`, `test/unit/keys.test.mjs`

**Interfaces:**
- Consumes: `JevError` and `analyze` from `src/jev.js`; `MIN_CHARS`, `MAX_CHARS`, `KEYCHECK_URL` from config.
- Produces:
  - `describeError(err) → {kind: "dense"|"network"|"format"|"key"|"credit"|"rate"|"other", message}`
  - `runCheck(text, {key, threshold, fetch, signal?, sleep?, post, analyzeOptions?}) → Promise<void>`. It posts messages of these shapes:
    - `{type:"progress", chars, done, total}`
    - `{type:"done", rows, threshold, chars, analysed, total, failed, cost, errors: string[]}`
    - `{type:"error", kind, message}`, where kind can also be `"nokey"|"short"|"long"`
  - `validateKey(key) → ""|message`, `keyHint(key) → string`, `checkKey(key, fetchFn) → Promise<void>` (throws `Error` with a user-facing message)

- [ ] **Step 1: Write the failing tests**

`test/unit/check.test.mjs`:
```js
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
```

`test/unit/keys.test.mjs`:
```js
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
```

- [ ] **Step 2: Run them and see them fail**

Run: `node --test test/unit/check.test.mjs test/unit/keys.test.mjs`
Expected: FAIL, with modules not found.

- [ ] **Step 3: Write `src/errors.js`**

```js
// Turn a failed check into a short message the card can show, with what to do about it.
import { JevError } from "./jev.js";

export function describeError(err) {
  if (!(err instanceof JevError)) return { kind: "other", message: `Something went wrong: ${err?.message ?? err}` };
  if (err.type === "max_tokens") return { kind: "dense", message: "Part of this selection is too dense for Jev to read at once. Try selecting less." };
  if (err.type === "network") return { kind: "network", message: "Couldn't reach OpenRouter. Check your connection and try again." };
  if (err.type === "format") return { kind: "format", message: "Jev's response format changed. Update Fallacy Lens to keep checking." };
  if (err.status === 401 || err.status === 403) return { kind: "key", message: "OpenRouter rejected your key. Update it in settings." };
  if (err.status === 402) return { kind: "credit", message: "Your OpenRouter account is out of credit. Top up at openrouter.ai, then try again." };
  if (err.status === 429) return { kind: "rate", message: "OpenRouter is rate-limiting requests. Wait a minute, then try again." };
  return { kind: "other", message: err.message };
}
```

- [ ] **Step 4: Write `src/check.js`**

```js
// One check, start to finish: validate the selection, run the analysis, and post what the card shows.
// The key goes to analyze() and nowhere else; posted messages carry only scores and text.
import { analyze } from "./jev.js";
import { describeError } from "./errors.js";
import { MIN_CHARS, MAX_CHARS } from "./config.js";

const fmt = n => n.toLocaleString("en-US");

export async function runCheck(text, { key, threshold = 50, fetch, signal, sleep, post, analyzeOptions = {} }) {
  const body = String(text ?? "").trim();
  if (!key) return post({ type: "error", kind: "nokey", message: "Add your OpenRouter key to start." });
  if (body.length < MIN_CHARS) return post({ type: "error", kind: "short", message: "Select a sentence or more." });
  if (body.length > MAX_CHARS) {
    return post({ type: "error", kind: "long", message: `This selection is ${fmt(body.length)} characters; the limit is ${fmt(MAX_CHARS)}.` });
  }
  const chars = body.length;
  try {
    const r = await analyze(key, body, {
      fetch, signal, sleep, ...analyzeOptions,
      onProgress: p => post({ type: "progress", chars, ...p }),
    });
    post({
      type: "done", rows: r.results, threshold, chars,
      analysed: r.analysed, total: r.total, failed: r.total - r.analysed,
      cost: r.cost, errors: r.errors.map(e => describeError(e).message),
    });
  } catch (e) {
    if (e?.type === "aborted" || signal?.aborted) return;
    post({ type: "error", ...describeError(e) });
  }
}
```

- [ ] **Step 5: Write `src/keys.js`**

```js
// Checking and displaying an OpenRouter key, for the options page.
import { KEYCHECK_URL } from "./config.js";

export function validateKey(key) {
  if (!key) return "Paste an OpenRouter API key (it starts with sk-or-).";
  if (/\s/.test(key)) return "That key contains spaces or line breaks. Paste just the key.";
  return "";
}

export function keyHint(key) {
  if (!key) return "";
  return key.length > 12 ? `${key.slice(0, 6)}…${key.slice(-4)}` : "…";
}

export async function checkKey(key, fetchFn) {
  let res;
  try {
    res = await fetchFn(KEYCHECK_URL, { headers: { Authorization: `Bearer ${key}` } });
  } catch {
    throw new Error("Couldn't reach OpenRouter. Check your connection and try again.");
  }
  if (res.status === 200) return;
  if (res.status === 401 || res.status === 403) throw new Error("OpenRouter rejected that key. Check you copied all of it.");
  throw new Error(`OpenRouter returned an error (${res.status}). Try again in a minute.`);
}
```

- [ ] **Step 6: Run them and see them pass**

Run: `make test`
Expected: PASS. The full unit suite stays green.

- [ ] **Step 7: Commit**

```bash
git add src/errors.js src/check.js src/keys.js test/unit/check.test.mjs test/unit/keys.test.mjs
git commit -m "Add check runner, user-facing error messages, key helpers

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Service worker, the card, popup fallback, icons, e2e

**Files:**
- Create: `src/background.js`, `src/card.js`, `src/popup-card.html`, `icons/icon.svg`, `icons/icon-{16,32,48,128}.png` (generated)
- Test: `test/e2e/harness.mjs`, `test/e2e/card.test.mjs`

**Interfaces:**
- Consumes: `runCheck` from `src/check.js`; the message shapes from Task 4.
- Produces:
  - Port name `"fallacylens-card"`. Card → background messages: `{type:"check", text}` | `{type:"check", token}` | `{type:"options"}`.
  - Test hook `globalThis.fallacyLensCheck(info, tab)` in the worker.
  - Card host element `<fallacy-lens-card>`.
  - `test/e2e/harness.mjs` exports `setup() → {cdp, sw, server, extId, openPage(path), close()}`, plus `waitFor`, `attach`, `findTarget`, `selectExpr`, `CARD`, `GOOD_KEY`. Task 6 uses these.

- [ ] **Step 1: Draw the icon and generate PNGs**

`icons/icon.svg`:
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="28" fill="#1f2937"/>
  <circle cx="56" cy="56" r="30" fill="none" stroke="#f8fafc" stroke-width="12"/>
  <path d="M79 79l25 25" stroke="#f8fafc" stroke-width="14" stroke-linecap="round"/>
  <path d="M42 52l9 9 6-14 9 15" fill="none" stroke="#f97316" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
```
Run: `make icons && ls icons`
Expected: `icon-16.png icon-32.png icon-48.png icon-128.png icon.svg`. Open `icons/icon-128.png` (Read tool) and check the lens with an orange zigzag is visible.

- [ ] **Step 2: Write the e2e harness**

`test/e2e/harness.mjs`:
```js
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
    this.ws = ws; this.id = 0; this.pending = new Map();
    ws.onmessage = e => {
      const m = JSON.parse(e.data);
      const p = m.id && this.pending.get(m.id);
      if (!p) return;
      this.pending.delete(m.id);
      m.error ? p.rej(new Error(`${p.method}: ${m.error.message}`)) : p.res(m.result);
    };
  }
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
  const cdp = await CDP.connect(wsUrl);
  const swInfo = await findTarget(cdp, t => t.type === "service_worker" && t.url.endsWith("/src/background.js"), "service worker");
  const sw = await attach(cdp, swInfo.targetId);
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
    return page;
  }

  return {
    cdp, sw, server, extId, openPage,
    setKey: key => sw.eval(key ? `chrome.storage.local.set({ key: ${JSON.stringify(key)} })` : `chrome.storage.local.remove("key")`),
    async close() {
      proc.kill();
      await once(proc, "exit").catch(() => {});
      server.close();
      rmSync(profile, { recursive: true, force: true });
      rmSync(ext, { recursive: true, force: true });
    },
  };
}
```

Each test opens its page with a unique query string (`/page.html?t=…`) so `page.check` finds exactly that tab. `fakeServer` routes on `url.pathname`, so the query string is ignored.

- [ ] **Step 3: Write the failing card e2e tests**

`test/e2e/card.test.mjs`:
```js
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
```

- [ ] **Step 4: Run them and see them fail**

Run: `make e2e`
Expected: FAIL. `setup()` times out waiting for the service worker (or Chromium reports a manifest error), because `src/background.js` doesn't exist. If Chromium itself fails to start, fix that first: set `CHROMIUM=/path/to/chromium`.

- [ ] **Step 5: Write `src/background.js`**

```js
// Fallacy Lens service worker: the right-click menu, injecting the card, and the card's connection.
// The only code that reads the OpenRouter key; the card receives scores, never the key.
import { runCheck } from "./check.js";

const MENU_ID = "fallacylens-check";
const PORT_NAME = "fallacylens-card";

chrome.runtime.onInstalled.addListener(({ reason }) => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: MENU_ID, title: "Check for fallacies", contexts: ["selection"] });
  });
  if (reason === "install") chrome.runtime.openOptionsPage();
});

chrome.action.onClicked.addListener(() => chrome.runtime.openOptionsPage());

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === MENU_ID) check(info, tab);
});

async function check(info, tab) {
  const fallback = info.selectionText || "";
  if (tab?.id >= 0) {
    const target = { tabId: tab.id, frameIds: [info.frameId ?? 0] };
    try {
      await chrome.scripting.executeScript({ target, func: t => { globalThis.__fallacyLensFallback = t; }, args: [fallback] });
      await chrome.scripting.executeScript({ target, files: ["src/card.js"] });
      return;
    } catch {
      // chrome:// pages, the Web Store, the PDF viewer, some frames: show the card in a popup instead.
    }
  }
  const token = crypto.randomUUID();
  await chrome.storage.session.set({ [`popup:${token}`]: fallback });
  await chrome.windows.create({ url: chrome.runtime.getURL(`src/popup-card.html#${token}`), type: "popup", width: 380, height: 520 });
}

// The e2e tests call this directly, because a headless browser can't click a context menu.
globalThis.fallacyLensCheck = check;

chrome.runtime.onConnect.addListener(port => {
  if (port.name !== PORT_NAME || port.sender?.id !== chrome.runtime.id) return;
  const ctrl = new AbortController();
  port.onDisconnect.addListener(() => ctrl.abort());
  const post = msg => { try { port.postMessage(msg); } catch { /* the card was closed */ } };
  port.onMessage.addListener(async msg => {
    if (msg?.type === "options") return chrome.runtime.openOptionsPage();
    if (msg?.type !== "check") return;
    let text = typeof msg.text === "string" ? msg.text : "";
    if (typeof msg.token === "string") {
      const k = `popup:${msg.token}`;
      text = (await chrome.storage.session.get(k))[k] ?? "";
      await chrome.storage.session.remove(k);
    }
    const { key = "", threshold = 50 } = await chrome.storage.local.get(["key", "threshold"]);
    await runCheck(text, { key, threshold, fetch: (...a) => fetch(...a), signal: ctrl.signal, post });
  });
});
```

- [ ] **Step 6: Write `src/card.js`**

```js
// Fallacy Lens card. background.js injects this into the page you right-clicked, or popup-card.html
// loads it when a page can't be scripted. It reads the selection, asks the background to check it,
// and shows the result. It never sees the API key: only scores come back over the port.
// A classic script, not a module, because injected content scripts can't be modules.
(() => {
  const SHADOW_MODE = "closed"; // the e2e test build switches this to "open" so tests can read the card
  const WIDTH = 340;
  const GAP = 8;
  const popup = location.protocol === "chrome-extension:";

  globalThis.__fallacyLensClose?.(); // one card per tab: a new check replaces the old one

  const CSS = `
    :host { all: initial; }
    *, *::before, *::after { box-sizing: border-box; }
    [hidden] { display: none !important; }
    .card {
      --bg: #ffffff; --fg: #1f2328; --muted: #656d76; --line: #d8dee4; --track: #eef1f4;
      --hi: #c2410c; --mid: #b7791f; --low: #8c959f; --focus: #0969da; --warn: #9a3412; --warn-bg: #fff4ed;
      width: 100%; color: var(--fg); background: var(--bg); border: 1px solid var(--line); border-radius: 10px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, .2); overflow: hidden; text-align: left;
      font: 13px/1.45 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    }
    @media (prefers-color-scheme: dark) {
      .card { --bg: #1c1f24; --fg: #e6edf3; --muted: #9198a1; --line: #3d444d; --track: #2d333b;
              --hi: #fb8f44; --mid: #e3b341; --low: #6e7681; --focus: #4493f8; --warn: #ffa198; --warn-bg: #3a1d1d; }
    }
    .card:focus { outline: none; }
    .card.popup { border: 0; border-radius: 0; box-shadow: none; min-height: 100vh; }
    header { display: flex; align-items: center; justify-content: space-between; padding: 6px 8px 6px 14px; border-bottom: 1px solid var(--line); }
    .title { font-weight: 600; }
    button { font: inherit; color: inherit; background: none; border: 0; cursor: pointer; }
    button:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; border-radius: 4px; }
    .close { width: 28px; height: 28px; border-radius: 6px; color: var(--muted); }
    .close:hover { background: var(--track); }
    .main { padding: 10px 14px; max-height: 60vh; overflow-y: auto; }
    .popup .main { max-height: none; }
    .status { display: flex; align-items: center; gap: 10px; color: var(--muted); padding: 6px 0; }
    .spin { flex: none; width: 14px; height: 14px; border: 2px solid var(--track); border-top-color: var(--focus); border-radius: 50%; animation: spin .8s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    @media (prefers-reduced-motion: reduce) { .spin { animation-duration: 2.4s; } }
    ul { list-style: none; margin: 0; padding: 0; }
    .row { display: grid; grid-template-columns: 1fr 80px 28px; align-items: center; gap: 10px; width: 100%; padding: 6px 4px; border-radius: 6px; text-align: left; }
    .row:hover { background: var(--track); }
    .name { font-weight: 500; }
    .bar { height: 6px; background: var(--track); border-radius: 3px; overflow: hidden; }
    .fill { display: block; height: 100%; background: var(--low); border-radius: 3px; }
    .hi .fill { background: var(--hi); }
    .mid .fill { background: var(--mid); }
    .score { text-align: right; font-variant-numeric: tabular-nums; color: var(--muted); }
    .hi .score, .mid .score { color: var(--fg); font-weight: 600; }
    .detail { padding: 0 4px 10px; color: var(--muted); }
    .detail p { margin: 4px 0 0; }
    .example { font-style: italic; }
    .more { color: var(--muted); padding: 8px 4px 2px; }
    .more:hover { color: var(--fg); }
    .rest { margin-top: 4px; }
    .calm { margin: 6px 0; }
    .warn { margin: 6px 0; padding: 8px 10px; border-radius: 6px; color: var(--warn); background: var(--warn-bg); }
    .action { margin-top: 6px; padding: 6px 12px; border-radius: 6px; background: var(--focus); color: #fff; font-weight: 600; }
    footer { display: flex; justify-content: space-between; gap: 12px; padding: 8px 14px 10px; border-top: 1px solid var(--line); color: var(--muted); font-size: 11.5px; }
    .cost { white-space: nowrap; }
  `;

  const fmt = n => n.toLocaleString("en-US");
  const level = s => (s >= 75 ? "hi" : s >= 50 ? "mid" : "low");
  const costText = c => (!c ? "" : c < 0.0001 ? "under $0.0001" : `$${c.toFixed(4)}`);

  function h(tag, props = {}, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (k === "class") el.className = v;
      else if (k === "text") el.textContent = v;
      else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v);
    }
    for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid);
    return el;
  }

  function selectedText() {
    const a = document.activeElement;
    const field = a && (a.tagName === "TEXTAREA" || (a.tagName === "INPUT" && /^(text|search|url|email)$/i.test(a.type)));
    if (field && a.selectionEnd > a.selectionStart) return a.value.slice(a.selectionStart, a.selectionEnd);
    const s = getSelection()?.toString() ?? "";
    return s.trim() ? s : globalThis.__fallacyLensFallback || "";
  }

  /** The selection's box in page coordinates, or the focused field's, or null. */
  function anchorRect() {
    const empty = r => !r || (!r.width && !r.height);
    const sel = getSelection();
    let r = sel?.rangeCount ? sel.getRangeAt(0).getBoundingClientRect() : null;
    const a = document.activeElement;
    if (empty(r) && a && a !== document.body && a !== document.documentElement) r = a.getBoundingClientRect();
    if (empty(r)) return null;
    return { top: r.top + scrollY, bottom: r.bottom + scrollY, left: r.left + scrollX };
  }

  const text = popup ? "" : selectedText();
  const anchor = popup ? null : anchorRect();

  const host = document.createElement("fallacy-lens-card");
  host.style.cssText = popup ? "all: initial; display: block;" : "all: initial; position: absolute; z-index: 2147483647; top: 0; left: 0;";
  const root = host.attachShadow({ mode: SHADOW_MODE });
  try {
    const sheet = new CSSStyleSheet(); // constructable sheets aren't blocked by a page's CSP
    sheet.replaceSync(CSS);
    root.adoptedStyleSheets = [sheet];
  } catch {
    root.append(h("style", { text: CSS }));
  }
  const main = h("div", { class: "main", "aria-live": "polite" });
  const foot = h("footer", { hidden: "" });
  const card = h("div", { class: popup ? "card popup" : "card", role: "dialog", "aria-label": "Fallacy Lens", tabindex: "-1" },
    h("header", {}, h("span", { class: "title", text: "Fallacy Lens" }),
      h("button", { class: "close", type: "button", "aria-label": "Close", text: "✕", onclick: () => close() })),
    main, foot);
  root.append(card);
  (popup ? document.body : document.documentElement).append(host);

  function place() {
    if (popup) return;
    const vw = document.documentElement.clientWidth || innerWidth;
    const width = Math.min(WIDTH, vw - 2 * GAP);
    host.style.width = `${width}px`;
    const maxLeft = scrollX + vw - width - GAP;
    const left = Math.max(scrollX + GAP, Math.min(anchor ? anchor.left : maxLeft, maxLeft));
    const height = host.offsetHeight;
    let top = scrollY + GAP;
    if (anchor) {
      const below = anchor.bottom + GAP, above = anchor.top - GAP - height;
      top = below + height > scrollY + innerHeight && above >= scrollY ? above : below;
    }
    host.style.left = `${left}px`;
    host.style.top = `${top}px`;
  }

  function show(...nodes) {
    main.replaceChildren(...nodes);
    place();
  }

  function checking(m) {
    const what = m?.chars ? `Checking ${fmt(m.chars)} characters…` : "Checking…";
    const part = m?.total > 1 ? ` part ${Math.min(m.done + 1, m.total)} of ${m.total}` : "";
    show(h("div", { class: "status" }, h("span", { class: "spin", "aria-hidden": "true" }), h("span", { text: what + part })));
  }

  function row(r) {
    const detail = h("div", { class: "detail", hidden: "" },
      h("p", { text: r.definition }), h("p", { class: "example", text: `e.g. “${r.example}”` }));
    const fill = h("span", { class: "fill" });
    fill.style.width = `${r.score}%`;
    const btn = h("button", { class: `row ${level(r.score)}`, type: "button", "aria-expanded": "false" },
      h("span", { class: "name", text: r.name }), h("span", { class: "bar", "aria-hidden": "true" }, fill),
      h("span", { class: "score", text: String(r.score) }));
    btn.addEventListener("click", () => {
      const open = btn.getAttribute("aria-expanded") !== "true";
      btn.setAttribute("aria-expanded", String(open));
      detail.hidden = !open;
      place();
    });
    return h("li", {}, btn, detail);
  }

  function results(m) {
    const shown = m.rows.filter(r => r.score >= m.threshold);
    const rest = m.rows.filter(r => r.score < m.threshold);
    const nodes = [];
    if (m.failed) nodes.push(h("p", { class: "warn", text: `${m.failed} of ${m.total} parts failed, so these may be incomplete.` }));
    if (shown.length) nodes.push(h("ul", { class: "rows" }, shown.map(row)));
    else nodes.push(h("p", { class: "calm", text: `No fallacies scored ${m.threshold} or more.` }));
    if (rest.length) {
      const list = h("ul", { class: "rows rest", hidden: "" }, rest.map(row));
      const label = shown.length ? `${rest.length} ${rest.length === 1 ? "other" : "others"} below ${m.threshold}` : "Show all scores";
      const more = h("button", { class: "more", type: "button", "aria-expanded": "false", text: `▸ ${label}` });
      more.addEventListener("click", () => {
        const open = list.hidden;
        list.hidden = !open;
        more.setAttribute("aria-expanded", String(open));
        more.textContent = `${open ? "▾" : "▸"} ${label}`;
        place();
      });
      nodes.push(more, list);
    }
    foot.replaceChildren(
      h("span", { text: "Scores are Jev's estimate that the text commits each fallacy, not a verdict." }),
      h("span", { class: "cost", text: costText(m.cost) }));
    foot.hidden = false;
    show(...nodes);
  }

  function failure(m) {
    const nodes = [h("p", { class: m.kind === "short" || m.kind === "nokey" ? "calm" : "warn", text: m.message })];
    if (m.kind === "nokey" || m.kind === "key") {
      nodes.push(h("button", { class: "action", type: "button", text: "Open settings", onclick: () => port.postMessage({ type: "options" }) }));
    }
    show(...nodes);
  }

  let finished = false;
  const port = chrome.runtime.connect({ name: "fallacylens-card" });
  port.onMessage.addListener(m => {
    /* e2e-log */
    if (m.type === "progress") checking(m);
    else if (m.type === "done") { finished = true; results(m); }
    else if (m.type === "error") { finished = true; failure(m); }
  });
  port.onDisconnect.addListener(() => {
    if (!finished) { finished = true; failure({ kind: "other", message: "Fallacy Lens stopped unexpectedly. Try the check again." }); }
  });

  function onKey(e) {
    if (e.key === "Escape") close();
  }
  function close() {
    document.removeEventListener("keydown", onKey, true);
    finished = true;
    try { port.disconnect(); } catch { /* already gone */ }
    host.remove();
    if (globalThis.__fallacyLensClose === close) globalThis.__fallacyLensClose = undefined;
    if (popup) window.close();
  }
  globalThis.__fallacyLensClose = close;
  document.addEventListener("keydown", onKey, true);

  checking(popup ? null : { chars: text.trim().length, total: 1, done: 0 });
  port.postMessage(popup ? { type: "check", token: location.hash.slice(1) } : { type: "check", text });
  card.focus({ preventScroll: true });
})();
```

- [ ] **Step 7: Write `src/popup-card.html`**

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Fallacy Lens</title>
  <style>html, body { margin: 0; background: Canvas; }</style>
</head>
<body>
  <script src="card.js"></script>
</body>
</html>
```

- [ ] **Step 8: Run the e2e suite until it passes**

Run: `make e2e`
Expected: PASS, 15 tests. If a test fails:
- **Placement tests:** dump `await page.card()` and the selection rect, and fix `place()`, not the assertion.
- **"textarea selection keeps line breaks":** check the `selectedText()` field branch runs, since `document.activeElement` must be the textarea.
- **"card is styled under a strict CSP":** confirm `adoptedStyleSheets` was used, not the `<style>` fallback.

Then run `make test` to confirm the unit suite is still green.

- [ ] **Step 9: Commit**

```bash
git add src/background.js src/card.js src/popup-card.html icons test/e2e
git commit -m "Add service worker, injected card, popup fallback and e2e suite

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Options page

**Files:**
- Create: `src/options.html`, `src/options.css`, `src/options.js`
- Test: `test/e2e/options.test.mjs`

**Interfaces:**
- Consumes: `validateKey`, `keyHint` and `checkKey` from `src/keys.js`; `setup`, `attach`, `findTarget`, `waitFor` and `GOOD_KEY` from `test/e2e/harness.mjs`.
- Produces: storage `key` (string) and `threshold` (number 30–80), the shapes the worker reads.

- [ ] **Step 1: Write the failing options e2e test**

`test/e2e/options.test.mjs`:
```js
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
  assert.equal((await storage()).key, undefined);
});

test("a good key is saved, cleared from the field, and shown only as a hint", async () => {
  await submit(GOOD_KEY);
  await waitFor(async () => (await storage()).key === GOOD_KEY, { what: "key saved" });
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
  await waitFor(async () => (await storage()).key === undefined, { what: "key removed" });
  assert.equal(await page.eval(`document.getElementById("key-form").hidden`), false);
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `node --test test/e2e/options.test.mjs`
Expected: FAIL. `before` times out waiting for `#key-form`, because `src/options.html` doesn't exist. Chrome shows an error page for the missing file.

- [ ] **Step 3: Write `src/options.html`**

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Fallacy Lens settings</title>
  <link rel="stylesheet" href="options.css">
</head>
<body>
<main>
  <h1>Fallacy Lens</h1>
  <p class="lede">Select text on any page, right-click, and choose <strong>Check for fallacies</strong>. Jev scores it for 24 common logical fallacies.</p>

  <section>
    <h2>OpenRouter key</h2>
    <form id="key-form">
      <label for="key">Paste your key</label>
      <div class="field">
        <input id="key" type="password" autocomplete="off" spellcheck="false" placeholder="sk-or-…">
        <button id="save" type="submit">Check &amp; save</button>
      </div>
      <p class="tip">Create one at <a href="https://openrouter.ai/keys" target="_blank" rel="noopener">openrouter.ai/keys</a>. Make a key just for this extension and give it a small credit limit. A check costs a fraction of a cent, so a dollar goes a long way.</p>
    </form>
    <div id="key-saved" hidden>
      <p>Saved key: <code id="hint"></code></p>
      <div class="buttons">
        <button id="replace" type="button">Replace</button>
        <button id="remove" type="button" class="quiet">Remove</button>
      </div>
    </div>
    <p id="status" role="status"></p>
  </section>

  <section>
    <h2>Show fallacies scoring</h2>
    <div class="field">
      <input id="threshold" type="range" min="30" max="80" step="5" value="50">
      <output id="threshold-value" for="threshold">50</output><span>or more</span>
    </div>
    <p class="tip">The card lists fallacies at or above this score first. The rest stay one click away.</p>
  </section>

  <section>
    <h2>Privacy</h2>
    <p>Selected text is sent to OpenRouter and Jev's maker, TypeSafe, only when you choose <strong>Check for fallacies</strong>. Fallacy Lens has no analytics and keeps no history. It stores only your key and this setting, on this device.</p>
  </section>
</main>
<script type="module" src="options.js"></script>
</body>
</html>
```

- [ ] **Step 4: Write `src/options.css`**

```css
:root {
  --bg: #f6f8fa; --panel: #ffffff; --fg: #1f2328; --muted: #656d76; --line: #d8dee4;
  --accent: #0969da; --error: #cf222e; --ok: #1a7f37;
  color-scheme: light dark;
}
@media (prefers-color-scheme: dark) {
  :root { --bg: #0d1117; --panel: #161b22; --fg: #e6edf3; --muted: #9198a1; --line: #3d444d;
          --accent: #4493f8; --error: #ff7b72; --ok: #3fb950; }
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--fg); font: 15px/1.5 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
main { max-width: 620px; margin: 0 auto; padding: 40px 16px 64px; }
h1 { margin: 0 0 4px; font-size: 26px; }
h2 { margin: 0 0 10px; font-size: 16px; }
.lede { color: var(--muted); margin: 0 0 24px; }
section { background: var(--panel); border: 1px solid var(--line); border-radius: 10px; padding: 18px 20px; margin-bottom: 16px; }
label { display: block; margin-bottom: 6px; font-weight: 500; }
.field { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
input[type=password] { flex: 1 1 260px; min-width: 0; padding: 8px 10px; font: 14px ui-monospace, monospace; color: var(--fg); background: var(--bg); border: 1px solid var(--line); border-radius: 6px; }
input[type=range] { flex: 1 1 200px; accent-color: var(--accent); }
output { font-weight: 600; font-variant-numeric: tabular-nums; min-width: 2ch; }
button { font: inherit; padding: 7px 14px; border-radius: 6px; border: 1px solid var(--line); background: var(--panel); color: var(--fg); cursor: pointer; }
button[type=submit], #replace { background: var(--accent); border-color: var(--accent); color: #fff; font-weight: 600; }
button:disabled { opacity: .6; cursor: progress; }
button:focus-visible, input:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.quiet { background: none; }
.buttons { display: flex; gap: 8px; }
.tip { color: var(--muted); font-size: 13.5px; margin: 10px 0 0; }
code { font: 14px ui-monospace, monospace; }
#status { margin: 10px 0 0; min-height: 1.5em; color: var(--ok); }
#status.error { color: var(--error); }
a { color: var(--accent); }
```

- [ ] **Step 5: Write `src/options.js`**

```js
// Options page: check and save the OpenRouter key, and the score threshold the card uses.
import { validateKey, keyHint, checkKey } from "./keys.js";

const $ = id => document.getElementById(id);

function say(message, isError = false) {
  $("status").textContent = message;
  $("status").classList.toggle("error", isError);
}

async function refresh() {
  const { key = "", threshold = 50 } = await chrome.storage.local.get(["key", "threshold"]);
  $("key-form").hidden = Boolean(key);
  $("key-saved").hidden = !key;
  $("hint").textContent = keyHint(key);
  $("threshold").value = String(threshold);
  $("threshold-value").textContent = String(threshold);
}

$("key-form").addEventListener("submit", async e => {
  e.preventDefault();
  const key = $("key").value.trim();
  const problem = validateKey(key);
  if (problem) return say(problem, true);
  say("Checking with OpenRouter…");
  $("save").disabled = true;
  try {
    await checkKey(key, fetch);
    await chrome.storage.local.set({ key });
    $("key").value = "";
    say("Saved. Select text on any page, right-click, and choose Check for fallacies.");
    await refresh();
  } catch (err) {
    say(err.message, true);
  } finally {
    $("save").disabled = false;
  }
});

$("replace").addEventListener("click", () => {
  $("key-form").hidden = false;
  $("key").focus();
});

$("remove").addEventListener("click", async () => {
  await chrome.storage.local.remove("key");
  say("Key removed.");
  await refresh();
});

$("threshold").addEventListener("input", e => {
  const threshold = Number(e.target.value);
  $("threshold-value").textContent = String(threshold);
  chrome.storage.local.set({ threshold });
});

refresh();
```

- [ ] **Step 6: Run the e2e suites until they pass**

Run: `make e2e`
Expected: PASS, both files (20 tests). Then run `make test`.

- [ ] **Step 7: Commit**

```bash
git add src/options.html src/options.css src/options.js test/e2e/options.test.mjs
git commit -m "Add options page: key check and save, threshold, privacy note

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Live probe, packaging, README

**Files:**
- Create: `tools/samples.mjs`, `tools/live.mjs`, `README.md`
- Modify: none (the `Makefile` targets already exist)

**Interfaces:**
- Consumes: `analyze` from `src/jev.js`; `CHUNK_CHARS` from config.
- Produces: `make live` (exit 0 = pass, 1 = fail, 2 = no key) and `make zip` (writes `dist/fallacylens-extension-0.1.0.zip`).

- [ ] **Step 1: Write `tools/samples.mjs`**

```js
// The six sample paragraphs, with the fallacies each is written to commit. The last is a control.
export const SAMPLES = [
  { name: "Town council", expect: ["slippery_slope", "strawman", "ad_hominem"],
    text: "My opponent wants to add a bike lane on Elm Street. Let's be honest about what that really means: she wants to ban cars from this town entirely. First it's one lane, then it's two, then parking meters triple and nobody can drive to the grocery store, and before you know it the whole downtown is a ghost town. And frankly, what would she know about running a town? She's lived here three years and still can't keep her own lawn mowed." },
  { name: "Supplement ad", expect: ["appeal_to_nature", "anecdotal", "bandwagon", "appeal_to_authority"],
    text: "VitaRoot is made from 100% natural herbs, so unlike those chemical-laden pharmacy pills, it simply can't hurt you. My uncle started taking it last spring and hasn't had a single cold since. Over two million Americans have already made the switch, so they can't all be wrong. Dr. Reynolds, a celebrated chiropractor who has appeared on morning television, calls it \"the most important health discovery of the century.\"" },
  { name: "Dinner argument", expect: ["tu_quoque", "black_or_white", "loaded_question", "burden_of_proof"],
    text: "You're telling me to cut back on sugar? You had two slices of cake at Mom's birthday last week, so you're hardly one to talk. Look, either I eat whatever I want or I live a miserable joyless life, and I'm picking the first one. Anyway, have you stopped nagging everyone about their diets yet? And until you can prove sugar is what's causing my headaches, I'm going to assume it isn't." },
  { name: "Faith in the fund", expect: ["gamblers_fallacy", "texas_sharpshooter", "false_cause", "special_pleading"],
    text: "The fund has lost money five quarters in a row, so it's practically guaranteed to rebound this quarter. Odds have to even out eventually. And look at the chart: every time the manager wore his red tie to the shareholder meeting, returns went up the following month. Clearly the tie works. Sure, the losses in 2024 don't fit the pattern, but that year was different and doesn't really count." },
  { name: "Philosophy club", expect: ["no_true_scotsman", "begging_the_question", "personal_incredulity", "genetic", "middle_ground"],
    text: "No real philosopher would ever take utilitarianism seriously. Professor Hale does, which only shows he isn't a real philosopher. The Bible is true because it says it's the word of God, and God doesn't lie. I can't imagine how something as complex as the eye could have evolved by chance, so it obviously didn't. Besides, the theory of evolution came from a Victorian gentleman with a beard, so why trust it? The truth is probably somewhere in the middle anyway." },
  { name: "Control", expect: [],
    text: "The city's 2025 traffic report found that collisions on Elm Street fell by 18 percent in the year after the speed limit was lowered from 35 to 25 mph. Other changes happened that year too, including new crosswalk signals and a temporary road closure for construction, so the report's authors caution that the speed limit can't be credited with the whole drop. They recommend a two-year comparison with similar streets nearby before deciding whether to apply the lower limit elsewhere." },
];

export const NEEDLE = "The encoder has failed on five consecutive test runs, so the sixth run is almost certain to succeed, since failures have to even out eventually.";
```

- [ ] **Step 2: Write `tools/live.mjs`**

```js
// Real-Jev smoke test and dilution probe. Costs under a cent.
// The key comes only from FALLACYLENS_TEST_KEY; it is never written anywhere.
import { analyze } from "../src/jev.js";
import { CHUNK_CHARS } from "../src/config.js";
import { SAMPLES, NEEDLE } from "./samples.mjs";

const key = process.env.FALLACYLENS_TEST_KEY;
if (!key) {
  console.error("Set FALLACYLENS_TEST_KEY to an OpenRouter key to run live checks (it is never saved).");
  process.exit(2);
}
let failed = 0, cost = 0;
const score = (r, id) => r.results.find(x => x.id === id)?.score ?? 0;

for (const s of SAMPLES) {
  const r = await analyze(key, s.text, { fetch });
  cost += r.cost;
  const high = r.results.filter(x => x.score >= 50).map(x => `${x.id} ${x.score}`);
  const hits = s.expect.filter(id => score(r, id) >= 50);
  const ok = s.expect.length ? hits.length * 2 >= s.expect.length : high.length === 0;
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"} ${s.name}: expected ${s.expect.join(", ") || "nothing"}; got ${high.join(", ") || "nothing ≥ 50"}`);
}

// Dilution: the needle hidden in ~100k chars of argumentative prose (Mill's On Liberty) vs the prose alone.
const book = await (await fetch("https://www.gutenberg.org/cache/epub/34901/pg34901.txt")).text();
const body = book.slice(book.indexOf("*** START OF"), book.indexOf("*** END OF"));
const filler = body.slice(body.indexOf("\n") + 1, CHUNK_CHARS - NEEDLE.length - 8);
const mid = filler.lastIndexOf("\n\n", filler.length / 2);
const withNeedle = `${filler.slice(0, mid)}\n\n${NEEDLE}\n\n${filler.slice(mid)}`;
const [a, b] = await Promise.all([analyze(key, withNeedle, { fetch }), analyze(key, filler, { fetch })]);
cost += a.cost + b.cost;
const hit = score(a, "gamblers_fallacy"), base = score(b, "gamblers_fallacy");
const diluted = hit < 60 || hit - base < 30;
if (diluted) failed++;
console.log(`${diluted ? "FAIL" : "PASS"} dilution at ${withNeedle.length.toLocaleString()} chars (${a.total} request): needle ${hit}, filler alone ${base}`);
if (diluted) console.log("  -> lower CHUNK_CHARS in src/config.js and re-run before release.");

console.log(`total cost $${cost.toFixed(4)}; ${failed ? `${failed} failed` : "all passed"}`);
process.exit(failed ? 1 : 0);
```

- [ ] **Step 3: Run the live probe**

Run: `FALLACYLENS_TEST_KEY=… make live`. Ask the user to run it with their own key; never read a key from a file.
Expected: 6 sample lines and a dilution line, mostly PASS, total cost under $0.01. Without the env var, it should exit 2 with the "Set FALLACYLENS_TEST_KEY" message, which you *can* check yourself: `make live; echo $?` → `2`.
- **If the dilution check fails:** lower `CHUNK_CHARS` (try 60,000) and re-run. Update the comment in `src/config.js` with the new measurement.
- **If a sample fails:** report it. Don't tune prompts to pass, because samples are a sanity check, not a target.

- [ ] **Step 4: Build the store zip**

Run: `make zip`
Expected: the listing shows `manifest.json`, `src/*` (13 files) and `icons/icon-*.png` (4), with no `test/`, `tools/`, `docs/` or `icon.svg`.

- [ ] **Step 5: Write `README.md`**

````markdown
# Fallacy Lens for Chrome

Select text on any page, right-click, and choose **Check for fallacies**. A card next to the selection
scores the text for the 24 fallacies on the *thou shalt not commit logical fallacies* poster, using
[Jev](https://openrouter.ai/typesafe) through OpenRouter. The card leads with the fallacies that score
highest. Click one to see what it means, with an example.

Scores are Jev's estimate (0–100) that the text commits each fallacy, not a verdict.

## Install (from source)

1. Clone this repo.
2. Open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked**, and pick the repo folder.
3. The settings page opens. Paste an OpenRouter key (create one at <https://openrouter.ai/keys>; a
   dedicated key with a small credit limit is a good idea). A check costs a fraction of a cent.

Settings are always one click away on the toolbar icon.

## Privacy

Selected text is sent to OpenRouter and Jev's maker, TypeSafe, only when you choose
**Check for fallacies**. There is no analytics and no history. Your key and your threshold are stored
in `chrome.storage.local` on your device and are only ever sent to OpenRouter.

## How scoring works

All 24 questions go to Jev in one request. Selections over 100,000 characters are split at paragraph
and sentence boundaries, with 600 characters of overlap. Each fallacy's score is its peak across the
parts, so the card says whether the selection *as a whole* contains it. The limit is 500,000 characters.

## Development

No dependencies; needs Node 22+ and, for e2e tests, Chromium.

    make test            # unit tests (offline, fake OpenRouter)
    make e2e             # headless Chromium against a fake OpenRouter (CHROMIUM=/path/to/chromium)
    FALLACYLENS_TEST_KEY=sk-or-… make live   # real Jev: sample texts + dilution probe, < $0.01
    make check-secrets   # run before every push
    make zip             # dist/fallacylens-extension-<version>.zip for the Chrome Web Store
    make fixtures        # regenerate chunking fixtures from the Fallacy Lens desktop app

## License

MIT
````

- [ ] **Step 6: Final checks**

Run: `make test && make e2e && make check-secrets && git status --short`
Expected: all green, `check-secrets: clean`, and only the new files from this task untracked (`dist/` is ignored).

- [ ] **Step 7: Commit and push (private repo)**

```bash
git add tools/samples.mjs tools/live.mjs README.md
git commit -m "Add live probe, store packaging and README

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push
```
Expected: pushed to `cobmuddybug/fallacylens-extension` (private). Do **not** change visibility.
