import assert from "node:assert/strict";
import test from "node:test";
import path from "path";
import { readFile, rm } from "fs/promises";
import { resolveModulesForSpec } from "@ai-studio/core";
import { assembleFromSpec } from "../src/assembly/assembler.js";
import { REPO_ROOT } from "../src/paths.js";

async function readJson(filePath: string) {
  const raw = await readFile(filePath, "utf-8");
  return JSON.parse(raw);
}

async function cleanup(buildId: string) {
  const workspaceDir = path.resolve(REPO_ROOT, "workspaces", buildId);
  await rm(workspaceDir, { recursive: true, force: true });
}

const okSpecPath = path.resolve(
  REPO_ROOT,
  "examples",
  "assembly",
  "gamespec.json"
);
const failSpecPath = path.resolve(
  REPO_ROOT,
  "examples",
  "assembly",
  "gamespec.fail.json"
);

test("module selection is deterministic from GameSpec", async () => {
  const spec = await readJson(okSpecPath);
  const first = resolveModulesForSpec(spec).modules;
  const second = resolveModulesForSpec(spec).modules;
  assert.deepEqual(first, ["idle-loop", "combat", "progression"]);
  assert.deepEqual(first, second);
});

test("assembly plan is generated deterministically", async () => {
  const spec = await readJson(okSpecPath);
  const { report, reportsDir } = await assembleFromSpec(spec);
  assert.equal(report.status, "PASS");

  const plan = await readJson(path.join(reportsDir, "assembly-plan.json"));
  assert.deepEqual(plan.integrationOrder, [
    "idle-loop",
    "combat",
    "progression",
  ]);
  assert.equal(plan.modules.length, 3);

  await cleanup(report.buildId);
});

test("assembly fails when module is missing", async () => {
  const spec = await readJson(failSpecPath);
  const { report, reportsDir } = await assembleFromSpec(spec);
  assert.equal(report.status, "FAIL");
  assert.ok(report.errors.some((err) => err.includes("inventory")));

  const smoke = await readJson(path.join(reportsDir, "runtime-smoke.json"));
  assert.equal(smoke.ok, false);
  assert.equal(smoke.reason, "missing-modules");

  await cleanup(report.buildId);
});
