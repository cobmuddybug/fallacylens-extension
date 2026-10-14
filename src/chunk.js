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
