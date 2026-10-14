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
