import test from "node:test";
import assert from "node:assert/strict";
import { FALLACIES, BY_ID, GROUPS } from "../../src/fallacies.js";

const POSTER_ORDER = [
  "strawman", "false_cause", "appeal_to_emotion", "fallacy_fallacy", "slippery_slope", "ad_hominem",
  "tu_quoque", "personal_incredulity", "special_pleading", "loaded_question", "burden_of_proof",
  "ambiguity", "gamblers_fallacy", "bandwagon", "appeal_to_authority", "composition_division",
  "no_true_scotsman", "genetic", "black_or_white", "begging_the_question", "appeal_to_nature",
  "anecdotal", "texas_sharpshooter", "middle_ground",
];

test("69 fallacies: the poster's 24 first, in poster order, then 45 more", () => {
  assert.equal(FALLACIES.length, 69);
  assert.deepEqual(FALLACIES.slice(0, 24).map(f => f.id), POSTER_ORDER);
  assert.equal(new Set(FALLACIES.map(f => f.id)).size, 69, "ids are unique");
  assert.equal(new Set(FALLACIES.map(f => f.name.toLowerCase())).size, 69, "names are unique");
});

test("every fallacy belongs to a known group, and every group is used", () => {
  for (const f of FALLACIES) assert.ok(GROUPS.includes(f.group), `${f.id}.group = ${f.group}`);
  assert.deepEqual([...new Set(FALLACIES.map(f => f.group))].sort(), [...GROUPS].sort());
});

test("every fallacy has every field filled in", () => {
  for (const f of FALLACIES) {
    for (const field of ["id", "name", "group", "definition", "guidance", "example"]) {
      assert.ok(typeof f[field] === "string" && f[field].trim().length > 3, `${f.id}.${field}`);
    }
    assert.ok(!/^e\.g\./i.test(f.example), `${f.id}.example should not start with e.g. (the card adds it)`);
  }
});

test("BY_ID indexes every fallacy", () => {
  assert.equal(Object.keys(BY_ID).length, 69);
  assert.equal(BY_ID.slippery_slope.name, "Slippery slope");
});

test("ids are snake_case so they can be question keys", () => {
  for (const f of FALLACIES) assert.match(f.id, /^[a-z][a-z_]*[a-z]$/, f.id);
});
