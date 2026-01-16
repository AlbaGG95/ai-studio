import assert from "node:assert/strict";
import test from "node:test";
import path from "path";
import { mkdir, readFile, rm, writeFile } from "fs/promises";
import {
  generateAndroidWrapperProject,
  validateAndroidWrapperSpec,
  type AndroidWrapperSpec,
} from "@ai-studio/core";
import { createDeterministicZip } from "../src/export/zip.js";
import { REPO_ROOT } from "../src/paths.js";

async function cleanup(dir: string) {
  await rm(dir, { recursive: true, force: true });
}

async function writeZip(
  files: Array<{ name: string; content: string }>,
  zipPath: string
) {
  const rootDir = path.join(path.dirname(zipPath), "zip-input");
  await rm(rootDir, { recursive: true, force: true });
  await mkdir(rootDir, { recursive: true });
  for (const file of files) {
    const filePath = path.join(rootDir, file.name);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, file.content, "utf-8");
  }
  const fileNames = files.map((file) => file.name).sort();
  await createDeterministicZip(zipPath, rootDir, fileNames);
  await rm(rootDir, { recursive: true, force: true });
}

function baseSpec(): AndroidWrapperSpec {
  return {
    schemaVersion: "android-wrapper@1",
    appId: "com.aistudio.wrapper",
    appName: "AI Wrapper",
    versionCode: 1,
    versionName: "0.1.0",
    orientation: "portrait",
  };
}

test("android wrapper spec validation passes and fails", () => {
  const valid = validateAndroidWrapperSpec(baseSpec());
  assert.equal(valid.valid, true);

  const invalid = validateAndroidWrapperSpec({
    ...baseSpec(),
    appId: "invalid id",
  });
  assert.equal(invalid.valid, false);
});

test("android wrapper generation is deterministic and has structure", async () => {
  const workspace = path.resolve(REPO_ROOT, "workspaces", "android-wrapper-test");
  await cleanup(workspace);
  await mkdir(workspace, { recursive: true });
  const zipPath = path.join(workspace, "export.zip");
  await writeZip(
    [
      { name: "index.html", content: "<html>ok</html>" },
      { name: "app.js", content: "console.log('ok');" },
    ],
    zipPath
  );

  const outDir = path.join(workspace, "out");
  const first = await generateAndroidWrapperProject({
    exportZipPath: zipPath,
    spec: baseSpec(),
    outDir,
  });
  const second = await generateAndroidWrapperProject({
    exportZipPath: zipPath,
    spec: baseSpec(),
    outDir,
  });

  assert.equal(first.ok, true);
  assert.equal(second.ok, true);

  const checksumFirst = await readFile(first.checksumPath, "utf-8");
  const checksumSecond = await readFile(second.checksumPath, "utf-8");
  assert.equal(checksumFirst, checksumSecond);

  const manifestPath = path.join(
    first.projectDir,
    "app",
    "src",
    "main",
    "AndroidManifest.xml"
  );
  const activityPath = path.join(
    first.projectDir,
    "app",
    "src",
    "main",
    "java",
    "com",
    "aistudio",
    "wrapper",
    "MainActivity.kt"
  );
  const indexPath = path.join(
    first.projectDir,
    "app",
    "src",
    "main",
    "assets",
    "www",
    "index.html"
  );

  assert.ok((await readFile(manifestPath, "utf-8")).length > 0);
  assert.ok((await readFile(activityPath, "utf-8")).length > 0);
  assert.ok((await readFile(indexPath, "utf-8")).length > 0);

  await cleanup(workspace);
});

test("android wrapper fails when index.html is missing", async () => {
  const workspace = path.resolve(
    REPO_ROOT,
    "workspaces",
    "android-wrapper-missing-index"
  );
  await cleanup(workspace);
  await mkdir(workspace, { recursive: true });
  const zipPath = path.join(workspace, "export.zip");
  await writeZip([{ name: "readme.txt", content: "no index" }], zipPath);

  const result = await generateAndroidWrapperProject({
    exportZipPath: zipPath,
    spec: baseSpec(),
    outDir: path.join(workspace, "out"),
  });

  assert.equal(result.ok, false);
  const report = JSON.parse(await readFile(result.reportPath, "utf-8"));
  assert.equal(report.ok, false);
  assert.ok(report.errors.some((err: string) => err.includes("index.html")));

  await cleanup(workspace);
});
