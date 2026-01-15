import assert from "node:assert/strict";
import test from "node:test";
import path from "path";
import { readFile } from "fs/promises";
import { resolveModulesForSpec } from "@ai-studio/core";
import { REPO_ROOT } from "../src/paths.js";

async function readJson(filePath: string) {
  const raw = await readFile(filePath, "utf-8");
  return JSON.parse(raw);
}

const specPath = path.resolve(
  REPO_ROOT,
  "examples",
  "assembly",
  "gamespec.json"
);

test("template registry resolves base modules", async () => {
  const spec = await readJson(specPath);
  const selection = resolveModulesForSpec(spec);
  assert.deepEqual(selection.modules, ["idle-loop", "combat", "progression"]);
  assert.deepEqual(selection.baseModules, [
    "idle-loop",
    "combat",
    "progression",
  ]);
  assert.equal(selection.templateId, "idle-rpg-base");
});

test("template registry applies conditions in order", async () => {
  const spec = await readJson(specPath);
  spec.systems.inventory.enabled = true;
  const selection = resolveModulesForSpec(spec);
  assert.ok(selection.modules.includes("inventory"));
  assert.ok(
    selection.conditionsApplied.some(
      (condition) => condition.path === "systems.inventory.enabled"
    )
  );
});

test("template registry throws on unknown template", async () => {
  const spec = await readJson(specPath);
  spec.engine.templateId = "unknown-template";
  assert.throws(
    () => resolveModulesForSpec(spec),
    /Template no registrado/
  );
});
