import assert from "node:assert/strict";
import test from "node:test";
import path from "path";
import { readFile, rm } from "fs/promises";
import { mockProvider } from "../src/ai/providers/mockProvider.js";
import { runAiPresetGeneration } from "../src/ai/pipeline.js";
import { REPO_ROOT } from "../src/paths.js";
import type { PresetProvider } from "../src/ai/providers/types.js";

async function cleanup(buildId: string) {
  const workspaceDir = path.resolve(REPO_ROOT, "workspaces", buildId);
  await rm(workspaceDir, { recursive: true, force: true });
}

async function readJson(filePath: string) {
  const raw = await readFile(filePath, "utf-8");
  return JSON.parse(raw);
}

test("mock provider is deterministic for the same prompt", async () => {
  const first = await mockProvider.generatePreset("demo prompt");
  const second = await mockProvider.generatePreset("demo prompt");
  assert.deepEqual(first.preset, second.preset);
  assert.equal(first.raw, second.raw);
});

test("repair loop retries and fails on invalid output", async () => {
  let calls = 0;
  const failingProvider: PresetProvider = {
    name: "fake",
    model: "fake",
    async generatePreset() {
      calls += 1;
      return {
        preset: null,
        raw: "not-json",
        provider: "fake",
        model: "fake",
      };
    },
  };

  const result = await runAiPresetGeneration("invalid output prompt", {
    provider: failingProvider,
    maxRetries: 2,
  });
  assert.equal(result.status, "FAIL");
  assert.equal(result.retries, 2);
  assert.equal(result.attempts.length, 3);
  assert.equal(calls, 3);

  const reportPath = path.resolve(
    REPO_ROOT,
    "workspaces",
    result.buildId,
    "reports",
    "ai-report.json"
  );
  const report = await readJson(reportPath);
  assert.equal(report.status, "FAIL");
  assert.equal(report.retries, 2);

  await cleanup(result.buildId);
});
