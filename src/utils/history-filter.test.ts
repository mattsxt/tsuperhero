import assert from "node:assert/strict";
import { test } from "node:test";

import {
  filterHistory,
  inPeriod,
  matchesSearch,
  newestFirst,
  periodStart,
} from "@/utils/history-filter";

const now = new Date(2026, 10, 26, 15, 30);

test("today starts at local midnight", () => {
  assert.deepEqual(periodStart("today", now), new Date(2026, 10, 26));
});

test("this week starts on Sunday", () => {
  assert.deepEqual(periodStart("week", now), new Date(2026, 10, 22));
  const sunday = new Date(2026, 10, 22, 9);
  assert.deepEqual(periodStart("week", sunday), new Date(2026, 10, 22));
});

test("last month reaches back to the same date a month ago", () => {
  assert.deepEqual(periodStart("month", now), new Date(2026, 9, 26));
  const march31 = new Date(2026, 2, 31, 8);
  assert.deepEqual(periodStart("month", march31), new Date(2026, 1, 28));
  const january = new Date(2026, 0, 15);
  assert.deepEqual(periodStart("month", january), new Date(2025, 11, 15));
});

test("all has no start, and undated items only show in all", () => {
  assert.equal(periodStart("all", now), null);
  assert.equal(inPeriod(null, "all", now), true);
  assert.equal(inPeriod(null, "today", now), false);
});

test("each period holds the one before it", () => {
  const dates = [
    new Date(2026, 10, 26, 7),
    new Date(2026, 10, 23),
    new Date(2026, 10, 1),
    new Date(2026, 8, 1),
  ];
  const count = (period: Parameters<typeof inPeriod>[1]) =>
    dates.filter((date) => inPeriod(date, period, now)).length;
  assert.deepEqual(
    [count("today"), count("week"), count("month"), count("all")],
    [1, 2, 3, 4],
  );
});

test("search matches every word, ignoring case and accents", () => {
  const fields = ["Peñafrancia Basilica", "ABC 123", null, "Jeepney"];
  assert.equal(matchesSearch(fields, ""), true);
  assert.equal(matchesSearch(fields, "  "), true);
  assert.equal(matchesSearch(fields, "penafrancia"), true);
  assert.equal(matchesSearch(fields, "abc jeep"), true);
  assert.equal(matchesSearch(fields, "abc bus"), false);
});

test("newest first puts undated items last without changing the input", () => {
  const items = [
    { id: "old", at: new Date(2026, 0, 1) },
    { id: "none", at: null },
    { id: "new", at: new Date(2026, 5, 1) },
  ];
  const sorted = newestFirst(items, (item) => item.at);
  assert.deepEqual(sorted.map((item) => item.id), ["new", "old", "none"]);
  assert.equal(items[0].id, "old");
});

test("filterHistory searches all time but shows only the period", () => {
  const items = [
    { name: "Naga", at: new Date(2026, 10, 26, 9) },
    { name: "Naga", at: new Date(2026, 10, 26, 12) },
    { name: "Naga", at: new Date(2026, 6, 1) },
    { name: "Legazpi", at: new Date(2026, 10, 26, 10) },
  ];
  const view = filterHistory(items, {
    period: "today",
    query: "naga",
    now,
    dateOf: (item) => item.at,
    searchFields: (item) => [item.name],
  });
  assert.equal(view.visible.length, 2);
  assert.equal(view.visible[0].at.getHours(), 12);
  assert.equal(view.matchesAllTime, 3);
  assert.equal(view.total, 4);
});
