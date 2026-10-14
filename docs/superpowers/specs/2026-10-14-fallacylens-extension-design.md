# Fallacy Lens for Chrome: design

Date: 2026-10-14. Status: approved in conversation and awaiting spec review.

## Goal

A Chrome extension: select text on any page, right-click **Check for fallacies**, and a card next to
the selection scores the text for the 24 fallacies from the *thou shalt not commit logical fallacies*
poster. Each fallacy the card reports comes with a definition and an example, so readers who don't
know the terms can follow it.

It's meant for other people to install, and this repo is meant to be public on GitHub. That means:

- Each user brings their own OpenRouter key. The extension calls Jev directly and needs no server.
- The repo never holds a credential, in any file, test or fixture.

This is a separate project from the Fallacy Lens desktop app (`~/Projects/fallacylens`). It starts with
its own copy of the fallacy list and prompts, and the two are allowed to drift.

## Model and API

- Endpoint: `POST https://openrouter.ai/api/alpha/decisions`, model `typesafe/jev-1.13`.
- One request covers one chunk of text and carries **all 24 questions**. Each is a `noul` (yes/no)
  question, and the yes-probability × 100 is the score (0–100).
- Request shape, prompt wording and answer parsing match the desktop app's `question()`, `ask_jev()`,
  `yes_probability()` and `chunk_scores()`.
- Headers: `Authorization: Bearer <key>`, `HTTP-Referer: https://github.com/cobmuddybug/fallacylens-extension`,
  `X-OpenRouter-Title: Fallacy Lens`.
- The endpoint is an alpha API. If a response is missing `answers`, the extension shows "Jev's response
  format changed" rather than wrong scores.

### Length limits (measured 2026-10-14)

All 24 questions were sent with a test fallacy hidden in the middle of neutral filler (libjpeg technical docs):

| Text length | Paragraph test (strawman / ad hominem / slippery slope) | One-sentence test (gambler's) | Filler only (max) |
|---|---|---|---|
| 3k chars | 93 / 92 / 87 | 85 | 5 |
| 30k | 88 / 87 / 77 | 82 | 5 |
| 60k | 86 / 88 / 72 | 82 | 7 |
| 120k | 85 / 88 / 71 | 83 | 5 |
| 200k | `max_tokens_exceeded` | `max_tokens_exceeded` | n/a |

Each call took about 1 s and cost $0.0002 at 3k characters, rising to $0.0013 at 120k. The hard cap is
about 64k tokens per request, counting the text plus the questions.

## Chunking

- Chunk size is **100,000 characters**, leaving headroom below the cap for token-dense text (code, URLs,
  non-English text).
- The splitting algorithm is ported from the desktop app's `chunk_text`:
  - Split at paragraph boundaries first.
  - Break any over-long paragraph at sentence boundaries.
  - Hard-cut only as a last resort.
- Each chunk after the first also gets the last **600 characters** of the chunk before it.
- When there's more than one chunk, each request's state description says "excerpt i of n …" (same as
  the app).
- If Jev returns `max_tokens_exceeded`, that chunk is split in half and both halves are retried.
  Halving can repeat, but never below 5,000 characters.
- Chunks are sent up to 2 at a time. In practice almost every selection is a single chunk.
- **Score per fallacy = its peak across chunks**, so the card answers whether the whole selection
  contains each fallacy. The UI has no per-chunk breakdown.
- The maximum selection is 500,000 characters. Anything longer is refused with a message.
- Before release, `make live` re-runs the dilution probe with *argumentative* filler. If the
  one-sentence test drops below 60 at 100k, the chunk size comes down.

## Components

Manifest V3, plain JavaScript ES modules, no build step and no runtime or dev dependencies.

| File | Responsibility |
|---|---|
| `manifest.json` | Permissions: `contextMenus`, `storage`, `activeTab`, `scripting`. Host permission: `https://openrouter.ai/*` only. Options page and service worker. |
| `src/fallacies.js` | The 24 fallacies as `{id, name, definition, guidance, example}`. `definition` and `guidance` come from the desktop app; `example` is a new, original one-sentence illustration. |
| `src/chunk.js` | `chunkText(text, size, overlap)` → `[{start, end, text}]`. Pure. |
| `src/jev.js` | `buildPayload(text, i, n)`, `scoresFrom(response)`, `askJev(key, text, i, n, {fetch, signal})` with retries, and `analyze(key, text, {fetch, signal, onProgress})` → `{results, analysed, total, cost, errors}`. Pure apart from the injected `fetch`. |
| `src/background.js` | The service worker. It registers the context menu, reads the key and threshold, injects the card into the clicked frame, runs `analyze` and sends progress and results to the card over a port. Closing the port aborts the run. |
| `src/card.js`, `src/card.css` | Injected only when the menu item is clicked. Reads the selection, renders the card in a closed shadow root and talks to the background over the port. |
| `src/popup-card.html` | The same card in a standalone page, for pages where injection isn't allowed. |
| `src/options.html`, `src/options.js` | Key entry and check, key hint/replace/remove, threshold slider, privacy note. |

**Flow:**
1. The user clicks the menu item, and the background injects `card.js` into `info.frameId`.
2. The card reads `getSelection().toString()`, which keeps line breaks, falling back to `info.selectionText`.
3. The card opens a port to the background and sends the text.
4. The background runs the analysis and sends `progress`, then `done` or `error`, back to the card.

**Key isolation:** only `background.js` reads the key. Nothing the card receives or renders contains it.

## The card

- **Placement:**
  - 340 px wide, placed under the selection's bounding rect; it flips above when there's no room below
    and is clamped to the viewport.
  - Positioned absolutely in page coordinates, so it scrolls with the text.
  - One card per tab: a new check replaces the old one.
- **Fallback:** when `scripting.executeScript` fails (`chrome://` pages, the Web Store, the PDF viewer),
  the background opens `popup-card.html` in a 380×520 popup window and passes it `info.selectionText`.
- **States:**
  - **No key:** "Add your OpenRouter key to start" and an *Open settings* button.
  - **Too short (< 15 characters):** "Select a sentence or more."
  - **Checking:** a spinner and "Checking 1,240 characters…", or "part 2 of 3".
  - **Results:** each fallacy at or above the threshold, sorted by score with ties broken by name, shown
    as name + bar + score.
    - Clicking a row (or pressing Enter) expands its definition and example.
    - "▸ N others below T" expands the rest.
  - **Nothing stands out:** "No fallacies scored above T" and *Show all scores*.
  - **Partial:** results plus "k of n parts failed, so these may be incomplete."
  - **Errors, each with a fix:**
    - Key rejected (401/403): update it in settings.
    - Out of credit (402).
    - Still rate-limited after retries.
    - Network unreachable.
    - Unexpected response format.
- **Footer:** "Scores are Jev's estimate that the text commits each fallacy, not a verdict." and the
  cost (for example "$0.0003").
- **Closing:**
  - ✕ or Esc closes the card. Clicking elsewhere does not.
  - Closing mid-check aborts the request.
- **Look:**
  - Light and dark themes via `prefers-color-scheme`, system fonts.
  - The shadow root isolates the card from page CSS.
  - Marked up as a dialog (`role="dialog"`) with a label, keyboard-reachable rows and a visible focus
    ring.

## Options and key handling

- Opens automatically on first install (`runtime.onInstalled`, reason `install`).
- **Check & save:**
  - `GET https://openrouter.ai/api/v1/key` with the pasted key. Only a 200 response saves it.
  - The key is saved to `chrome.storage.local`, never `storage.sync`.
  - Keys containing whitespace, or that are empty, are rejected before the request.
- **After saving:** only a hint is shown (`sk-or-…a1b2`), with *Replace* and *Remove*.
- **Tip:** create a dedicated key at openrouter.ai/keys with a small credit limit.
- **Threshold slider:** 30–80, default 50, stored in `storage.local`.
- **Privacy note (also in the README and the Web Store listing):** selected text goes to OpenRouter and
  TypeSafe only when the user runs a check. There is no analytics or history, and nothing besides the
  key and threshold is stored.

## Retries and errors

- Retried up to 4 attempts, with backoff `min(10, 2·attempt)` s (honouring `Retry-After` when present):
  408, 409, 429, 499, 500, 502, 503, 504, and network errors.
- Failing immediately: 400 (except `max_tokens_exceeded`, which splits instead), 401, 402, 403.
- 401, 402 or 403 aborts the remaining chunks.
- If every chunk fails, the card shows the first error. If some fail, it shows the partial state.

## Testing

All tests use `node --test` (Node ≥ 22). No packages.

- **`make test`** (offline):
  - `chunkText` against JSON fixtures generated once from the desktop app's `chunk_text` (script in
    `tools/`, which writes `test/fixtures/`).
  - The payload contains all 24 questions with the expected wording.
  - Score parsing covers the `noul`, `probability` and `probabilities` shapes.
  - Retry and give-up behaviour per status code.
  - Splitting in half on `max_tokens_exceeded`.
  - Peak aggregation, the 401 abort, and partial results.
  - Everything runs against a fake `fetch`.
- **`make e2e`:**
  - Launches `/usr/bin/chromium` headless with a test copy of the extension whose endpoint constants
    point at a local fake Jev server, and drives it over the DevTools protocol using Node's built-in
    WebSocket.
  - The test calls the background's check entry point directly, since a context menu can't be clicked
    headlessly.
  - It checks every card state, placement and flipping, Esc and ✕, replacement, and abort-on-close.
  - It also checks that the key string never appears in the page's DOM or in messages to the card.
  - The release build has no endpoint override.
- **`make live`:** the 6 sample paragraphs plus the argumentative-filler dilution probe, against real
  Jev. The key comes **only** from `$FALLACYLENS_TEST_KEY`. Costs under $0.01.
- **`make check-secrets`:** fails if any git-tracked file matches `sk-or-` or a long base64/hex token.
- **`make zip`:** builds `dist/fallacylens-extension-<version>.zip` from `manifest.json` + `src/` +
  icons only.

## Repo hygiene

- `.gitignore` covers `*.key`, `.env*`, `*api_key*`, `dist/`, `*.zip`, `*.crx`, `*.pem`.
- No personal paths, emails or keys in any tracked file. Commits use the GitHub noreply identity.
- README: what it does, install from source (load unpacked), getting a key, privacy, running the tests.
- License: MIT (confirm at review).

## Out of scope for v1

- Per-chunk breakdowns.
- Highlighting phrases within the selection (Jev scores whole texts).
- History.
- Firefox.
- Keyboard shortcut trigger.
- Syncing with the desktop app's fallacy list.
- Publishing to the Chrome Web Store. v1 makes the store zip, and submitting it is a separate step.
