import assert from "node:assert/strict";
import test from "node:test";
import path from "path";
import { readFile, rm } from "fs/promises";
import { assembleFromSpec } from "../src/assembly/assembler.js";
import {
  runPresetGame,
  runPresetSpecGeneration,
} from "../src/preset/pipeline.js";
import { REPO_ROOT } from "../src/paths.js";

async function readJson(filePath: string) {
  const raw = await readFile(filePath, "utf-8");
  return JSON.parse(raw);
}

async function cleanup(buildId: string) {
  const workspaceDir = path.resolve(REPO_ROOT, "workspaces", buildId);
  await rm(workspaceDir, { recursive: true, force: true });
}

const inventoryPresetPath = path.resolve(
  REPO_ROOT,
  "examples",
  "presets",
  "preset.inventory.json"
);

test("preset generation is deterministic for identical input", async () => {
  const preset = {
    meta: {
      name: "Deterministic Preset",
      version: "0.1.0",
      language: "es",
      templateId: "idle-rpg-base@1.2",
    },
    tuning: {
      pacing: "normal",
      difficulty: "normal",
      economy: "normal",
      inventoryEnabled: false,
      damageFormula: "linear",
      progressionScaling: "linear",
      levels: 20,
    },
    seed: "deterministic-preset",
  };

  const first = await runPresetSpecGeneration(preset);
  const firstSpec = await readFile(
    path.join(first.reportsDir, "gamespec.generated.json"),
    "utf-8"
  );

  const second = await runPresetSpecGeneration(preset);
  const secondSpec = await readFile(
    path.join(second.reportsDir, "gamespec.generated.json"),
    "utf-8"
  );

  assert.equal(first.buildId, second.buildId);
  assert.equal(firstSpec, secondSpec);

  await cleanup(first.buildId);
});

test("preset pipeline blocks on invalid preset", async () => {
  const preset = {
    meta: {
      name: "Invalid Preset",
      version: "0.1.0",
      language: "es",
      templateId: "idle-rpg-base",
    },
    tuning: {
      pacing: "fast",
      difficulty: "easy",
      economy: "normal",
      inventoryEnabled: false,
      damageFormula: "linear",
      progressionScaling: "linear",
      levels: 5,
    },
  };

  const result = await runPresetGame(preset);
  assert.equal(result.validationOk, false);
  assert.equal(result.assemblyStatus, "FAIL");

  const report = await readJson(
    path.join(result.reportsDir, "generation-report.json")
  );
  assert.equal(report.presetValid, false);
  assert.ok(report.errors.length > 0);

  await cleanup(result.buildId);
});

test("preset inventory enables inventory module selection", async () => {
  const preset = await readJson(inventoryPresetPath);
  const generation = await runPresetSpecGeneration(preset);
  assert.equal(generation.validationOk, true);
  assert.equal(generation.spec?.systems.inventory.enabled, true);

  const assembly = await assembleFromSpec(generation.spec!, {
    buildId: generation.buildId,
    cleanWorkspace: false,
  });

  const selection = await readJson(
    path.join(generation.reportsDir, "module-selection.json")
  );
  assert.ok(selection.finalModules.includes("inventory"));

  await cleanup(generation.buildId);
});
