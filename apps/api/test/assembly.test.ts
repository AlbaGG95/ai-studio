import assert from "node:assert/strict";
import test from "node:test";
import path from "path";
import { readFile, rm, writeFile, mkdir } from "fs/promises";
import { resolveModulesForSpec } from "@ai-studio/core";
import { assembleFromSpec } from "../src/assembly/assembler.js";
import { REPO_ROOT } from "../src/paths.js";
import { createHash } from "crypto";

async function readJson(filePath: string) {
  const raw = await readFile(filePath, "utf-8");
  return JSON.parse(raw);
}

async function cleanup(buildId: string) {
  const workspaceDir = path.resolve(REPO_ROOT, "workspaces", buildId);
  await rm(workspaceDir, { recursive: true, force: true });
}

function hashString(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

async function writeModule(
  baseDir: string,
  moduleId: string,
  entryPath: string,
  files: { path: string; content: string }[]
) {
  const moduleDir = path.join(baseDir, moduleId);
  await mkdir(moduleDir, { recursive: true });
  for (const file of files) {
    const normalized = file.path.replace(/\\/g, "/");
    const prefix = `modules/${moduleId}/`;
    const relative = normalized.startsWith(prefix)
      ? normalized.slice(prefix.length)
      : normalized;
    const target = path.join(moduleDir, relative);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, file.content, "utf-8");
  }
  const manifest = {
    version: "1.0",
    module: {
      id: moduleId,
      name: moduleId,
      kind: "system",
      entry: entryPath,
      templateId: "idle-rpg-base",
    },
    provides: { events: [], state: [], commands: [] },
    consumes: { events: [], state: [], commands: [] },
    files: files.map((file) => ({
      path: file.path,
      role: "logic",
      sha256: hashString(file.content),
    })),
  };
  await writeFile(
    path.join(moduleDir, "feature-manifest.json"),
    JSON.stringify(manifest, null, 2),
    "utf-8"
  );
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

test("assembly blocks when integrator rejects paths", async () => {
  const spec = await readJson(okSpecPath);
  const moduleBase = path.resolve(REPO_ROOT, "workspaces", "test-modules");
  await rm(moduleBase, { recursive: true, force: true });
  await mkdir(moduleBase, { recursive: true });

  const okContent =
    "export const module = { id: \"idle-loop\", init: () => {}, start: () => {}, tick: () => {}, stop: () => {}, dispose: () => {} }; export default module;";
  await writeModule(moduleBase, "idle-loop", "modules/idle-loop/index.ts", [
    { path: "modules/idle-loop/index.ts", content: okContent },
  ]);
  await writeModule(moduleBase, "combat", "modules/combat/index.ts", [
    { path: "modules/other/escape.ts", content: okContent },
  ]);
  await writeModule(moduleBase, "progression", "modules/progression/index.ts", [
    { path: "modules/progression/index.ts", content: okContent },
  ]);

  const { report } = await assembleFromSpec(spec, { moduleBaseDir: moduleBase });
  assert.equal(report.status, "FAIL");
  assert.ok(
    report.errors.some((err) => err.includes("feature-manifest.integration"))
  );

  await cleanup(report.buildId);
  await rm(moduleBase, { recursive: true, force: true });
});

test("assembly smoke fails when module entrypoint cannot load", async () => {
  const spec = await readJson(okSpecPath);
  const moduleBase = path.resolve(REPO_ROOT, "workspaces", "test-modules-smoke");
  await rm(moduleBase, { recursive: true, force: true });
  await mkdir(moduleBase, { recursive: true });

  const okContent =
    "export const module = { id: \"idle-loop\", init: () => {}, start: () => {}, tick: () => {}, stop: () => {}, dispose: () => {} }; export default module;";
  await writeModule(moduleBase, "idle-loop", "modules/idle-loop/index.ts", [
    { path: "modules/idle-loop/index.ts", content: okContent },
  ]);
  await writeModule(moduleBase, "combat", "modules/combat/index.ts", [
    { path: "modules/combat/index.ts", content: "export const nope = 1;" },
  ]);
  await writeModule(moduleBase, "progression", "modules/progression/index.ts", [
    { path: "modules/progression/index.ts", content: okContent },
  ]);

  const { report, reportsDir } = await assembleFromSpec(spec, {
    moduleBaseDir: moduleBase,
  });
  assert.equal(report.status, "FAIL");
  const smoke = await readJson(path.join(reportsDir, "runtime-smoke.json"));
  assert.equal(smoke.ok, false);
  assert.ok(smoke.error);

  await cleanup(report.buildId);
  await rm(moduleBase, { recursive: true, force: true });
});

test("assembly smoke busts cache when module files change", async () => {
  const spec = await readJson(okSpecPath);
  const moduleBase = path.resolve(REPO_ROOT, "workspaces", "test-modules-cache");
  await rm(moduleBase, { recursive: true, force: true });
  await mkdir(moduleBase, { recursive: true });

  const okContent =
    "export const module = { id: \"idle-loop\", init: () => {}, start: () => {}, tick: () => {}, stop: () => {}, dispose: () => {} }; export default module;";
  await writeModule(moduleBase, "idle-loop", "modules/idle-loop/index.ts", [
    { path: "modules/idle-loop/index.ts", content: okContent },
  ]);
  await writeModule(moduleBase, "progression", "modules/progression/index.ts", [
    { path: "modules/progression/index.ts", content: okContent },
  ]);

  const entryContent = [
    'import { marker } from "./marker.ts";',
    "export const module = {",
    "  id: `combat-${marker}`,",
    "  init: () => {},",
    "  start: () => {},",
    "  tick: () => {},",
    "  stop: () => {},",
    "  dispose: () => {},",
    "};",
    "export default module;",
  ].join("\n");

  await writeModule(moduleBase, "combat", "modules/combat/index.ts", [
    { path: "modules/combat/index.ts", content: entryContent },
    { path: "modules/combat/marker.ts", content: "export const marker = \"one\";" },
  ]);

  const first = await assembleFromSpec(spec, { moduleBaseDir: moduleBase });
  assert.equal(first.report.status, "PASS");
  const smokeFirst = await readJson(
    path.join(first.reportsDir, "runtime-smoke.json")
  );
  assert.ok(smokeFirst.loadedModules.includes("combat-one"));

  await writeModule(moduleBase, "combat", "modules/combat/index.ts", [
    { path: "modules/combat/index.ts", content: entryContent },
    { path: "modules/combat/marker.ts", content: "export const marker = \"two\";" },
  ]);

  const second = await assembleFromSpec(spec, { moduleBaseDir: moduleBase });
  assert.equal(second.report.status, "PASS");
  const smokeSecond = await readJson(
    path.join(second.reportsDir, "runtime-smoke.json")
  );
  assert.ok(smokeSecond.loadedModules.includes("combat-two"));

  await cleanup(second.report.buildId);
  await rm(moduleBase, { recursive: true, force: true });
});
