import assert from "node:assert/strict";
import test from "node:test";
import path from "path";
import { readFile, rm } from "fs/promises";
import { createHash } from "crypto";
import { exportBuild } from "../src/export/exporter.js";
import { assembleFromSpec } from "../src/assembly/assembler.js";
import { REPO_ROOT } from "../src/paths.js";

async function readJson(filePath: string) {
  const raw = await readFile(filePath, "utf-8");
  return JSON.parse(raw);
}

async function hashFile(filePath: string) {
  const data = await readFile(filePath);
  return createHash("sha256").update(data).digest("hex");
}

function testBuildId(label: string) {
  return `export-${createHash("sha256").update(label).digest("hex").slice(0, 12)}`;
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

test("export build creates deterministic zip", async () => {
  const spec = await readJson(okSpecPath);
  const { report } = await assembleFromSpec(spec, {
    buildId: testBuildId("export-pass"),
  });
  assert.equal(report.status, "PASS");

  const first = await exportBuild(report.buildId);
  const firstHash = await hashFile(first.zipPath);
  const second = await exportBuild(report.buildId);
  const secondHash = await hashFile(second.zipPath);
  assert.equal(firstHash, secondHash);

  const checksumPath = path.join(first.exportDir, "checksum.sha256");
  const checksumContent = await readFile(checksumPath, "utf-8");
  assert.ok(checksumContent.includes("build/assembly/"));
  assert.ok(checksumContent.includes("reports/"));

  await cleanup(report.buildId);
});

test("export build fails when build is not PASS", async () => {
  const spec = await readJson(failSpecPath);
  const { report } = await assembleFromSpec(spec, {
    buildId: testBuildId("export-fail"),
  });
  assert.equal(report.status, "FAIL");

  await assert.rejects(
    () => exportBuild(report.buildId),
    /Build no PASS/
  );

  await cleanup(report.buildId);
});
