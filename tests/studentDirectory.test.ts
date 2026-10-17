import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  affinity, courseChips, escapeLike, filterStudents, isFiltering, matchesQuery, mergeStudents, NO_FILTER, pageOf,
  rankStudents, sameCourse, sharedSubjects, wantsRemoteSearch, withoutHidden, type Student,
} from "../src/lib/studentDirectory.ts";

const me: Student = { id: "me", full_name: "Me", course: "Medicine", interests: ["English Language", "Biology", "Chemistry", "Physics"] };
const mk = (id: string, name: string, course: string | null, interests: string[] = []): Student => ({ id, full_name: name, course, interests });
const NONE = new Set<string>();

test("same course ignores capitals and spacing, and accepts a longer name of the same course", () => {
  assert.equal(sameCourse("Medicine", " medicine "), true);
  assert.equal(sameCourse("Medicine", "Medicine and Surgery"), true);
  assert.equal(sameCourse("Law", "Lawn Care"), false, "a prefix of one word is not the same course");
  assert.equal(sameCourse("Law", "Law"), true);
  assert.equal(sameCourse("Law", "Law and Order"), false, "3-letter words must match exactly");
  for (const bad of [null, undefined, "", "A"]) assert.equal(sameCourse(bad, "Medicine"), false);
});

test("closeness: same course counts 5, each shared subject 2, nothing known counts 0", () => {
  assert.equal(affinity(me, mk("a", "A", "medicine", ["Biology", "chemistry", "Government"])), 9);
  assert.equal(affinity(me, mk("b", "B", "Law", ["Biology"])), 2);
  assert.equal(affinity(me, mk("c", "C", null)), 0);
  assert.equal(affinity(null, mk("d", "D", "Medicine")), 0);
  assert.deepEqual(sharedSubjects(me, mk("e", "E", null, ["biology", "Art"])), ["biology"]);
});

test("ranking puts classmates first, then online students, then A–Z, without changing the input", () => {
  const list = [
    mk("z", "Zane", "Law"),
    mk("o", "Olu", "Law"),
    mk("m", "Mary", "Medicine"),
    mk("b", "Bisi", "Law", ["Biology"]),
  ];
  const copy = [...list];
  const ranked = rankStudents(list, me, new Set(["o"]));
  assert.deepEqual(ranked.map((s) => s.id), ["m", "b", "o", "z"]);
  assert.deepEqual(list, copy);
  assert.deepEqual(rankStudents(list, null, NONE).map((s) => s.id), ["b", "m", "o", "z"], "with no profile it is just A–Z");
});

test("search needs every word to match name, course or subject", () => {
  const s = mk("1", "Ada Obi", "Medicine", ["Biology"]);
  assert.equal(matchesQuery(s, "ada"), true);
  assert.equal(matchesQuery(s, "ada medicine"), true);
  assert.equal(matchesQuery(s, "  MEDICINE   ada "), true);
  assert.equal(matchesQuery(s, "biol"), true);
  assert.equal(matchesQuery(s, "ada law"), false);
  assert.equal(matchesQuery(s, ""), true);
  assert.equal(matchesQuery({ id: "2", full_name: "No Course" }, "course"), true, "missing course/interests do not crash");
});

test("filters combine: online, same course, a picked course and the search box", () => {
  const list = [mk("a", "Ada", "Medicine"), mk("b", "Bayo", "medicine"), mk("c", "Chi", "Law"), mk("d", "Dayo", "Medicine and Surgery")];
  const on = new Set(["a", "c"]);
  assert.deepEqual(filterStudents(list, NO_FILTER, me, on).map((s) => s.id), ["a", "b", "c", "d"]);
  assert.deepEqual(filterStudents(list, { ...NO_FILTER, online: true }, me, on).map((s) => s.id), ["a", "c"]);
  assert.deepEqual(filterStudents(list, { ...NO_FILTER, sameCourse: true }, me, on).map((s) => s.id), ["a", "b", "d"]);
  assert.deepEqual(filterStudents(list, { ...NO_FILTER, course: "MEDICINE" }, me, on).map((s) => s.id), ["a", "b"]);
  assert.deepEqual(filterStudents(list, { ...NO_FILTER, sameCourse: true, online: true, query: "ad" }, me, on).map((s) => s.id), ["a"]);
  assert.equal(filterStudents(list, { ...NO_FILTER, sameCourse: true }, null, on).length, 0, "no profile → nobody is 'same course'");
});

test("isFiltering is true for any active filter", () => {
  assert.equal(isFiltering(NO_FILTER), false);
  assert.equal(isFiltering({ ...NO_FILTER, query: "  " }), false);
  for (const f of [{ query: "x" }, { online: true }, { sameCourse: true }, { course: "Law" }]) assert.equal(isFiltering({ ...NO_FILTER, ...f }), true);
});

test("course chips group spellings, count them, and keep the most used spelling", () => {
  const list = [
    mk("1", "A", "Medicine"), mk("2", "B", "medicine"), mk("3", "C", "Medicine"), mk("4", "D", "Law"), mk("5", "E", " law "),
    mk("6", "F", "Accounting"), mk("7", "G", null), mk("8", "H", ""), mk("9", "I", "x"),
  ];
  assert.deepEqual(courseChips(list), [
    { key: "medicine", label: "Medicine", count: 3 },
    { key: "law", label: "law", count: 2 },
    { key: "accounting", label: "Accounting", count: 1 },
  ]);
  assert.equal(courseChips(list, 1).length, 1);
});

test("merging keeps the first copy and adds only new people", () => {
  const a = [mk("1", "One", null), mk("2", "Two", null)];
  const b = [mk("2", "Two (stale)", null), mk("3", "Three", null)];
  const merged = mergeStudents(a, b);
  assert.deepEqual(merged.map((s) => s.id), ["1", "2", "3"]);
  assert.equal(merged[1].full_name, "Two");
});

test("typed % _ and backslash are letters, not wildcards, in the server search", () => {
  assert.equal(escapeLike("100%_sure\\"), "100\\%\\_sure\\\\");
  assert.equal(escapeLike("ada"), "ada");
  assert.equal(wantsRemoteSearch("a"), false);
  assert.equal(wantsRemoteSearch(" a "), false);
  assert.equal(wantsRemoteSearch("ad"), true);
});

test("paging shows a page and says how many are left", () => {
  const list = Array.from({ length: 50 }, (_, i) => i);
  assert.deepEqual(pageOf(list, 24), { shown: list.slice(0, 24), remaining: 26 });
  assert.deepEqual(pageOf(list, 999), { shown: list, remaining: 0 });
  assert.deepEqual(pageOf([], 24), { shown: [], remaining: 0 });
  assert.deepEqual(pageOf(list, -5), { shown: [], remaining: 50 });
});

test("my own row and blocked people never appear", () => {
  const list = [mk("me", "Me", null), mk("x", "Blocked", null), mk("y", "Fine", null)];
  assert.deepEqual(withoutHidden(list, "me", new Set(["x"])).map((s) => s.id), ["y"]);
  assert.equal(withoutHidden(list, null, NONE).length, 3);
});

test("the Messages page uses the Students tab, hides blocked people and escapes the server search", () => {
  const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8");
  const page = read("../src/app/messages/page.tsx");
  assert.ok(page.includes("<StudentsTab"));
  assert.ok(page.includes('.from("user_blocks")'), "blocked people must be loaded so they can be hidden");
  assert.ok(page.includes("withoutHidden("));
  const tab = read("../src/components/StudentsTab.tsx");
  assert.ok(tab.includes("escapeLike(q)"), "typed text must be escaped before it goes into ILIKE");
  assert.ok(tab.includes("grid-cols-1") === false && tab.includes("min-w-0"), "rows must be able to shrink inside the screen");
});
