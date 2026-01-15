import assert from "node:assert/strict";
import test from "node:test";
import path from "path";
import { readFile } from "fs/promises";
import {
  resolveModulesForSpec,
  resolveModulesForSpecWithRegistry,
} from "@ai-studio/core";
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
      (condition) =>
        "path" in condition.condition &&
        condition.condition.path === "systems.inventory.enabled"
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

test("condition operators: exists, in, gte, lte, and, or", async () => {
  const spec = await readJson(specPath);
  spec.systems.inventory.enabled = true;
  spec.systems.progression.levels = 60;
  spec.systems.combat.damageFormula = "scaling";

  const registry = {
    version: "1.0",
    templates: {
      "idle-rpg-base": {
        baseModules: ["base"],
        conditionalModules: [
          { when: { path: "systems.inventory", exists: true }, add: ["exists-true"] },
          { when: { path: "systems.inventory.missing", exists: false }, add: ["exists-false"] },
          { when: { path: "systems.combat.damageFormula", in: ["linear", "scaling"] }, add: ["in-true"] },
          { when: { path: "systems.combat.damageFormula", in: ["exponential"] }, add: ["in-false"] },
          { when: { path: "systems.progression.levels", gte: 50 }, add: ["gte-true"] },
          { when: { path: "systems.progression.levels", lte: 10 }, add: ["lte-false"] },
          {
            when: {
              and: [
                { path: "systems.inventory.enabled", equals: true },
                { path: "systems.progression.levels", gte: 30 }
              ]
            },
            add: ["and-true"]
          },
          {
            when: {
              or: [
                { path: "systems.inventory.enabled", equals: false },
                { path: "systems.progression.levels", gte: 30 }
              ]
            },
            add: ["or-true"]
          }
        ],
      },
    },
  };

  const selection = resolveModulesForSpecWithRegistry(spec, registry);
  assert.ok(selection.modules.includes("exists-true"));
  assert.ok(selection.modules.includes("exists-false"));
  assert.ok(selection.modules.includes("in-true"));
  assert.ok(!selection.modules.includes("in-false"));
  assert.ok(selection.modules.includes("gte-true"));
  assert.ok(!selection.modules.includes("lte-false"));
  assert.ok(selection.modules.includes("and-true"));
  assert.ok(selection.modules.includes("or-true"));
});

test("registry version 1.0 remains compatible", async () => {
  const spec = await readJson(specPath);
  const registry = {
    version: "1.0",
    templates: {
      "idle-rpg-base": {
        baseModules: ["idle-loop"],
        conditionalModules: [
          {
            when: { path: "systems.inventory.enabled", equals: true },
            add: ["inventory"],
          },
        ],
      },
    },
  };

  const selection = resolveModulesForSpecWithRegistry(spec, registry);
  assert.deepEqual(selection.modules, ["idle-loop"]);
});
