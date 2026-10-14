// Ask Jev (through OpenRouter's decisions API) whether a text commits each of the 69 fallacies.
// One request per chunk carries all 69 yes/no questions; a fallacy's score is its peak across chunks.

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

/** The yes-probability in an answer, or null when the answer has no field we recognise. */
function readProbability(answer) {
  for (const k of ["noul", "probability"]) {
    const v = Number(answer?.[k]);
    if (answer?.[k] != null && answer[k] !== "" && Number.isFinite(v)) return clamp01(v);
  }
  const probs = answer?.probabilities;
  if (probs && typeof probs === "object") {
    const v = Number(probs.true ?? probs.yes);
    if ((probs.true ?? probs.yes) != null && Number.isFinite(v)) return clamp01(v);
  }
  return null;
}

export function yesProbability(answer) {
  return readProbability(answer) ?? 0;
}

// If no question has a score we can read, the API's format has changed: say so rather than show zeros.
const hasScores = data => Object.entries(data.answers).some(([id, ans]) => BY_ID[id] && readProbability(ans) !== null);

/** {fallacy id: 0-100} from one Jev response; unanswered questions are left out. */
export function scoresFrom(response) {
  const out = {};
  for (const [id, ans] of Object.entries(response?.answers ?? {})) {
    if (BY_ID[id] && ans && typeof ans === "object") out[id] = Math.round(yesProbability(ans) * 100);
  }
  return out;
}

const FETCH_TIMEOUT_MS = 60_000;
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

export async function askJev(key, text, index, total, { fetch, signal, sleep = realSleep, retries = RETRIES, timeoutMs = FETCH_TIMEOUT_MS } = {}) {
  const body = JSON.stringify(buildPayload(text, index, total));
  let last;
  for (let attempt = 1; attempt <= retries; attempt++) {
    if (signal?.aborted) throw aborted();
    let res = null, wait = Math.min(10, 2 * attempt) * 1000;
    const timeout = AbortSignal.timeout(timeoutMs);
    const attemptSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;
    try {
      res = await fetch(DECISIONS_URL, {
        method: "POST", body, signal: attemptSignal,
        headers: {
          Authorization: `Bearer ${key}`, "Content-Type": "application/json",
          "HTTP-Referer": REFERER, "X-OpenRouter-Title": TITLE,
        },
      });
    } catch (e) {
      if (signal?.aborted) throw aborted();
      last = timeout.aborted
        ? new JevError("OpenRouter took too long to answer", { type: "network" })
        : new JevError(`could not reach OpenRouter: ${e?.message ?? e}`, { type: "network" });
    }
    if (res) {
      const raw = await res.text().catch(() => "");
      if (signal?.aborted) throw aborted();
      let data = null;
      try { data = JSON.parse(raw); } catch { /* not JSON */ }
      if (res.ok) {
        if (!data || typeof data.answers !== "object" || data.answers === null || !hasScores(data)) {
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
    id: f.id, name: f.name, group: f.group, definition: f.definition, example: f.example,
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
      resp = await limit(async () => {
        if (inner.signal.aborted) throw aborted();
        try {
          return await askJev(key, piece, Math.min(seq++, total - 1), total, { fetch, signal: inner.signal, sleep });
        } catch (e) {
          // Abort before the limiter frees this slot, or the next queued chunk would still be sent.
          if ([401, 402, 403].includes(e.status)) stop();
          throw e;
        }
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
