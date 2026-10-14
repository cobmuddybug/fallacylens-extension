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
