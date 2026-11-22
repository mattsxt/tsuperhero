import assert from "node:assert/strict";
import { test } from "node:test";

import { initials, initialsOf } from "@/utils/initials";

test("initials are two capital letters from first and last name", () => {
  assert.equal(initials("Juan", "Dela Cruz"), "JD");
  assert.equal(initials("ana", "reyes"), "AR");
  assert.equal(initials("Maria Clara", "Santos"), "MS");
  assert.equal(initials("Bicol Demo Transport", "Cooperative"), "BC");
  assert.equal(initials("Juan", null), "J");
  assert.equal(initials(null, null), "?");
  assert.equal(initials("", " ", "D"), "D");
});

test("initials from a full name use its first two words", () => {
  assert.equal(initialsOf("Mario Santos"), "MS");
  assert.equal(initialsOf("Juan Dela Cruz"), "JD");
  assert.equal(initialsOf("pedro"), "P");
  assert.equal(initialsOf("  "), "?");
  assert.equal(initialsOf(null, "D"), "D");
});
