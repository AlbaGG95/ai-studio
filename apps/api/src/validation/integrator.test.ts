import assert from "node:assert/strict";
import test from "node:test";
import { validateWriteOperations } from "./integrator.js";
import type { FeatureManifest } from "@ai-studio/core";

const HASH = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

function makeManifest(): FeatureManifest {
  return {
    version: "1.0",
    module: {
      id: "mod-a",
      name: "Module A",
      kind: "system",
      entry: "modules/mod-a/index.ts",
      templateId: "idle-rpg-base",
    },
    provides: { events: [], state: [], commands: [] },
    consumes: { events: [], state: [], commands: [] },
    files: [
      {
        path: "modules/mod-a/index.ts",
        role: "logic",
        sha256: HASH,
      },
      {
        path: "modules/mod-a/feature.ts",
        role: "logic",
        sha256: HASH,
      },
    ],
  };
}

test("integrator blocks path traversal", () => {
  const errors = validateWriteOperations([makeManifest()], [
    { moduleId: "mod-a", path: "../escape.ts" },
  ]);
  assert.ok(errors.some((error) => error.includes("Path invalido")));
});

test("integrator normalizes paths and allows declared files", () => {
  const errors = validateWriteOperations([makeManifest()], [
    { moduleId: "mod-a", path: "modules\\mod-a\\feature.ts" },
  ]);
  assert.equal(errors.length, 0);
});

test("integrator blocks writes outside module root", () => {
  const errors = validateWriteOperations([makeManifest()], [
    { moduleId: "mod-a", path: "modules/other/feature.ts" },
  ]);
  assert.ok(errors.some((error) => error.includes("fuera del modulo")));
});
