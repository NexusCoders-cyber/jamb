import test from "node:test";
import assert from "node:assert/strict";
import { applySupplements, type Supplement } from "../src/lib/pictureSupplement.ts";

const table: Supplement[] = [{ subject: "biology", id: "17", year: "2003", image: "/question-images/biology-17-2003.png" }];
const list = [
  { id: "17", year: "2003", prompt: "The point marked I is referred to as" },
  { id: "17", year: "2010", prompt: "Another question" },
  { id: "18", year: "2003", prompt: "Third", image: "keep.png" },
];

test("our own picture is attached by subject, id and year", () => {
  const out = applySupplements("Biology", list, table) as { image?: string }[];
  assert.equal(out[0].image, "/question-images/biology-17-2003.png");
  assert.equal(out[1].image, undefined); // same id, different year: not the same question
  assert.equal(out[2].image, "keep.png"); // a picture ALOC sent is never replaced
});

test("another subject or an empty table changes nothing", () => {
  assert.equal(applySupplements("physics", list, table)[0], list[0]);
  assert.equal(applySupplements("biology", list, []), list);
});

import { existsSync } from "node:fs";
import { SUPPLEMENTS } from "../src/lib/pictureSupplement.ts";

test("every picture in the table exists, and no question is listed twice", () => {
  const seen = new Set<string>();
  for (const s of SUPPLEMENTS) {
    assert.ok(existsSync(new URL(`../public${s.image}`, import.meta.url)), `${s.image} is missing`);
    const k = `${s.subject}|${s.id}|${s.year}`;
    assert.ok(!seen.has(k), `${k} is listed twice`);
    seen.add(k);
    assert.equal(s.subject, s.subject.toLowerCase());
  }
  assert.equal(SUPPLEMENTS.length, 7);
});
