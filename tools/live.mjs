// Real-Jev smoke test and dilution probe. Costs under a cent.
// The key comes only from FALLACYLENS_TEST_KEY; it is never written anywhere.
import { analyze } from "../src/jev.js";
import { FALLACIES } from "../src/fallacies.js";
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

// Each fallacy's own example should score 50 or more for that fallacy.
const misses = [];
for (let i = 0; i < FALLACIES.length; i += 4) {
  const batch = FALLACIES.slice(i, i + 4);
  const runs = await Promise.all(batch.map(f => analyze(key, f.example, { fetch })));
  runs.forEach((r, j) => { cost += r.cost; if (score(r, batch[j].id) < 50) misses.push(`${batch[j].id} ${score(r, batch[j].id)}`); });
}
if (misses.length) failed++;
console.log(`${misses.length ? "FAIL" : "PASS"} examples: ${FALLACIES.length - misses.length} of ${FALLACIES.length} score 50+ for their own fallacy${misses.length ? `; low: ${misses.join(", ")}` : ""}`);

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

const alarms = b.results.filter(x => x.score >= 50).map(x => `${x.id} ${x.score}`);
if (alarms.length) failed++;
console.log(`${alarms.length ? "FAIL" : "PASS"} filler alone: ${alarms.length ? alarms.join(", ") : "nothing scores 50+"}`);

console.log(`total cost $${cost.toFixed(4)}; ${failed ? `${failed} failed` : "all passed"}`);
process.exit(failed ? 1 : 0);
