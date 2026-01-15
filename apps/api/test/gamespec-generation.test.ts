import assert from "node:assert/strict";
import test from "node:test";
import path from "path";
import { readFile, rm } from "fs/promises";
import { runGameGeneration, runGameSpecGeneration } from "../src/gamespec/pipeline.js";
import { REPO_ROOT } from "../src/paths.js";

async function readJson(filePath: string) {
  const raw = await readFile(filePath, "utf-8");
  return JSON.parse(raw);
}

async function cleanup(buildId: string) {
  const workspaceDir = path.resolve(REPO_ROOT, "workspaces", buildId);
  await rm(workspaceDir, { recursive: true, force: true });
}

const okIntentPath = path.resolve(
  REPO_ROOT,
  "examples",
  "gamespec",
  "intent.ok.json"
);
const failIntentPath = path.resolve(
  REPO_ROOT,
  "examples",
  "gamespec",
  "intent.fail.json"
);

test("gamespec generation is deterministic for identical intent", async () => {
  const intent = {
    name: "Deterministic Game",
    inventoryEnabled: true,
    levels: 20,
  };

  const first = await runGameSpecGeneration(intent);
  const firstSpec = await readFile(
    path.join(first.reportsDir, "gamespec.generated.json"),
    "utf-8"
  );

  const second = await runGameSpecGeneration(intent);
  const secondSpec = await readFile(
    path.join(second.reportsDir, "gamespec.generated.json"),
    "utf-8"
  );

  assert.equal(first.buildId, second.buildId);
  assert.equal(firstSpec, secondSpec);

  await cleanup(first.buildId);
});

test("game generation blocks on invalid intent", async () => {
  const intent = await readJson(failIntentPath);
  const result = await runGameGeneration(intent);
  assert.equal(result.validationOk, false);
  assert.equal(result.assemblyStatus, "FAIL");

  const reportPath = path.join(result.reportsDir, "generation-report.json");
  const report = await readJson(reportPath);
  assert.equal(report.validationOk, false);
  assert.ok(report.validationErrors.length > 0);

  await cleanup(result.buildId);
});

test("game generation passes and produces runtime smoke", async () => {
  const intent = await readJson(okIntentPath);
  const result = await runGameGeneration(intent);
  assert.equal(result.validationOk, true);
  assert.equal(result.assemblyStatus, "PASS");

  const smokePath = path.join(result.reportsDir, "runtime-smoke.json");
  const smoke = await readJson(smokePath);
  assert.equal(smoke.ok, true);

  await cleanup(result.buildId);
});
