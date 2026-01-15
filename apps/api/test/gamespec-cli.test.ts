import assert from "node:assert/strict";
import test from "node:test";
import path from "path";
import { resolveIntentPath } from "../src/gamespec/cliUtils.js";
import { REPO_ROOT } from "../src/paths.js";

test("resolveIntentPath resolves relative paths from repo root", () => {
  const resolved = resolveIntentPath("examples/gamespec/intent.ok.json");
  const expected = path.resolve(
    REPO_ROOT,
    "examples",
    "gamespec",
    "intent.ok.json"
  );
  assert.equal(resolved, expected);
});
