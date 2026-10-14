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
