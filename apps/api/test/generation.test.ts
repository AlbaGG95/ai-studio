import assert from "node:assert/strict";
import test from "node:test";
import path from "path";
import { rm, readFile } from "fs/promises";
import { generateModule } from "../src/generation/generator.js";
import { REPO_ROOT } from "../src/paths.js";

async function readJson(filePath: string) {
  const raw = await readFile(filePath, "utf-8");
  return JSON.parse(raw);
}

async function cleanup(buildId: string, generationId: string) {
  const stagingDir = path.resolve(REPO_ROOT, "staging", generationId);
  const workspaceDir = path.resolve(REPO_ROOT, "workspaces", buildId);
  await rm(stagingDir, { recursive: true, force: true });
  await rm(workspaceDir, { recursive: true, force: true });
}

test("generator is deterministic for identical input", async () => {
  const input = {
    module: {
      id: "determinism-module",
      name: "Determinism Module",
      kind: "system",
    },
    provides: {
      events: ["determinism.ready"],
      state: ["state.determinism"],
      commands: [],
    },
    consumes: {
      events: [],
      state: [],
      commands: [],
    },
    files: [
      {
        path: "modules/determinism-module/index.ts",
        content: "export const boot = () => \"ok\";",
      },
    ],
  };

  const first = await generateModule(input);
  const reportPath = path.resolve(
    REPO_ROOT,
    "workspaces",
    first.buildId,
    "reports",
    "generated-manifest.json"
  );
  const manifestFirst = await readFile(reportPath, "utf-8");

  const second = await generateModule(input);
  const manifestSecond = await readFile(reportPath, "utf-8");

  assert.equal(first.generationId, second.generationId);
  assert.equal(first.buildId, second.buildId);
  assert.equal(manifestFirst, manifestSecond);
  assert.deepEqual(first.files, second.files);

  await cleanup(first.buildId, first.generationId);
});

test("generator blocks on security violations", async () => {
  const input = {
    module: {
      id: "fail-security-module",
      name: "Fail Security Module",
      kind: "system",
    },
    files: [
      {
        path: "modules/fail-security-module/index.ts",
        content: "export const boot = () => { eval(\"1\"); };",
      },
    ],
  };

  const result = await generateModule(input);
  assert.equal(result.validationOk, false);

  const reportPath = path.resolve(
    REPO_ROOT,
    "workspaces",
    result.buildId,
    "reports",
    "generation-report.json"
  );
  const report = await readJson(reportPath);
  const blocked = report.blockedSteps.map((step: any) => step.id);
  assert.ok(blocked.includes("security.ast-scan"));

  await cleanup(result.buildId, result.generationId);
});

test("generator blocks on path violations", async () => {
  const input = {
    module: {
      id: "fail-path-module",
      name: "Fail Path Module",
      kind: "system",
    },
    files: [
      {
        path: "modules/other/escape.ts",
        content: "export const boot = () => \"bad\";",
      },
    ],
  };

  const result = await generateModule(input);
  assert.equal(result.validationOk, false);

  const reportPath = path.resolve(
    REPO_ROOT,
    "workspaces",
    result.buildId,
    "reports",
    "generation-report.json"
  );
  const report = await readJson(reportPath);
  const blocked = report.blockedSteps.map((step: any) => step.id);
  assert.ok(blocked.includes("feature-manifest.integration"));

  await cleanup(result.buildId, result.generationId);
});
