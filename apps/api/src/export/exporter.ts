import { createHash } from "crypto";
import { mkdir, readFile, rm, writeFile, access } from "fs/promises";
import path from "path";
import { REPO_ROOT } from "../paths.js";
import { createDeterministicZip, hashZip } from "./zip.js";

export interface ExportResult {
  buildId: string;
  status: "PASS";
  exportDir: string;
  zipPath: string;
  checksum: string;
}

interface BuildManifest {
  buildId: string;
  templateId?: string;
  templateVersionUsed?: string;
  specHash?: string;
  createdFrom: "intent" | "spec";
  hashes: {
    assembly: string;
    reports: string;
  };
}

const REPORT_FILES = [
  "assembly-report.json",
  "validation-report.json",
  "runtime-smoke.json",
  "module-selection.json",
  "template-resolution.json",
  "build-manifest.json",
];

function toPosix(value: string) {
  return value.replace(/\\/g, "/");
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function hashString(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

async function hashFile(filePath: string): Promise<string> {
  const data = await readFile(filePath);
  return createHash("sha256").update(data).digest("hex");
}

async function listFiles(rootDir: string): Promise<string[]> {
  const entries: string[] = [];
  async function walk(current: string) {
    const items = await import("fs/promises").then(({ readdir }) =>
      readdir(current, { withFileTypes: true })
    );
    const sorted = items.sort((a, b) => a.name.localeCompare(b.name));
    for (const item of sorted) {
      const full = path.join(current, item.name);
      if (item.isDirectory()) {
        await walk(full);
      } else if (item.isFile()) {
        entries.push(toPosix(path.relative(rootDir, full)));
      }
    }
  }
  await walk(rootDir);
  return entries.sort();
}

async function copyDir(src: string, dest: string): Promise<void> {
  const files = await listFiles(src);
  for (const file of files) {
    const sourcePath = path.join(src, file);
    const targetPath = path.join(dest, file);
    await mkdir(path.dirname(targetPath), { recursive: true });
    const content = await readFile(sourcePath);
    await writeFile(targetPath, content);
  }
}

async function hashDirectory(rootDir: string): Promise<string> {
  const files = await listFiles(rootDir);
  const lines: string[] = [];
  for (const file of files) {
    const hash = await hashFile(path.join(rootDir, file));
    lines.push(`${file}:${hash}`);
  }
  return hashString(lines.join("\n"));
}

async function readJson(filePath: string): Promise<any> {
  const raw = await readFile(filePath, "utf-8");
  return JSON.parse(raw);
}

async function buildManifestForExport(
  buildId: string,
  workspaceDir: string
): Promise<BuildManifest> {
  const reportsDir = path.join(workspaceDir, "reports");
  const artifactsDir = path.join(workspaceDir, "artifacts");

  const templateResolutionPath = path.join(
    reportsDir,
    "template-resolution.json"
  );
  const moduleSelectionPath = path.join(reportsDir, "module-selection.json");

  let templateId: string | undefined;
  let templateVersionUsed: string | undefined;
  if (await exists(templateResolutionPath)) {
    const resolution = await readJson(templateResolutionPath);
    templateId = resolution.resolvedTemplateId?.split("@")[0];
    templateVersionUsed = resolution.versionUsed;
  } else if (await exists(moduleSelectionPath)) {
    const selection = await readJson(moduleSelectionPath);
    templateId = selection.templateId;
    templateVersionUsed = selection.templateVersionUsed;
  }

  const specHashPath = path.join(artifactsDir, "gamespec.hash");
  const specHash = (await exists(specHashPath))
    ? (await readFile(specHashPath, "utf-8")).trim()
    : undefined;

  const createdFrom = (await exists(path.join(reportsDir, "intent-input.json")))
    ? "intent"
    : "spec";

  const assemblyDir = path.join(workspaceDir, "assembly");
  const reportsHash = await hashDirectory(reportsDir);
  const assemblyHash = await hashDirectory(assemblyDir);

  return {
    buildId,
    templateId,
    templateVersionUsed,
    specHash,
    createdFrom,
    hashes: {
      assembly: assemblyHash,
      reports: reportsHash,
    },
  };
}

async function writeChecksumFile(
  exportRoot: string
): Promise<string> {
  const files = (await listFiles(exportRoot)).filter(
    (file) => file !== "checksum.sha256"
  );
  const lines: string[] = [];
  for (const file of files) {
    const hash = await hashFile(path.join(exportRoot, file));
    lines.push(`${hash}  ${file}`);
  }
  const content = lines.join("\n");
  const checksumPath = path.join(exportRoot, "checksum.sha256");
  await writeFile(checksumPath, content);
  return hashString(content);
}

export async function exportBuild(buildId: string): Promise<ExportResult> {
  const workspaceDir = path.resolve(REPO_ROOT, "workspaces", buildId);
  const reportsDir = path.join(workspaceDir, "reports");
  const assemblyDir = path.join(workspaceDir, "assembly");
  const assemblyReportPath = path.join(reportsDir, "assembly-report.json");

  if (!(await exists(assemblyReportPath))) {
    throw new Error(`Assembly report no encontrado para build: ${buildId}`);
  }
  const assemblyReport = await readJson(assemblyReportPath);
  if (assemblyReport.status !== "PASS") {
    throw new Error(`Build no PASS: ${buildId}`);
  }

  const exportDir = path.join(workspaceDir, "export");
  const exportRoot = path.join(exportDir, "export");
  await rm(exportDir, { recursive: true, force: true });
  await mkdir(exportRoot, { recursive: true });

  const buildRoot = path.join(exportRoot, "build");
  const buildAssembly = path.join(buildRoot, "assembly");
  await mkdir(buildAssembly, { recursive: true });
  await copyDir(assemblyDir, buildAssembly);

  const assetsDir = path.join(workspaceDir, "assets");
  if (await exists(assetsDir)) {
    await copyDir(assetsDir, path.join(buildRoot, "assets"));
  }

  const runtimeSrc = path.resolve(REPO_ROOT, "packages", "core", "runtime");
  if (await exists(runtimeSrc)) {
    await copyDir(runtimeSrc, path.join(buildRoot, "runtime"));
  }

  const exportReports = path.join(exportRoot, "reports");
  await mkdir(exportReports, { recursive: true });
  for (const file of REPORT_FILES) {
    const source = path.join(reportsDir, file);
    if (await exists(source)) {
      const target = path.join(exportReports, file);
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, await readFile(source));
    }
  }

  const manifestPath = path.join(reportsDir, "build-manifest.json");
  if (!(await exists(manifestPath))) {
    const manifest = await buildManifestForExport(buildId, workspaceDir);
    await writeFile(
      manifestPath,
      JSON.stringify(manifest, null, 2),
      "utf-8"
    );
  }
  const manifestTarget = path.join(exportReports, "build-manifest.json");
  if (await exists(manifestPath)) {
    await writeFile(manifestTarget, await readFile(manifestPath));
  }

  const metadataDir = path.join(exportRoot, "metadata");
  await mkdir(metadataDir, { recursive: true });
  const manifest = await readJson(path.join(exportReports, "build-manifest.json"));
  await writeFile(
    path.join(metadataDir, "build.json"),
    JSON.stringify(manifest, null, 2),
    "utf-8"
  );
  await writeFile(
    path.join(metadataDir, "README.txt"),
    [
      "AI Studio export build",
      "Use build/assembly with the runtime to run the game.",
      "Reports are in reports/.",
    ].join("\n"),
    "utf-8"
  );

  await writeChecksumFile(exportRoot);

  const zipPath = path.join(exportDir, `${buildId}.zip`);
  const files = (await listFiles(exportDir)).filter((file) =>
    file.startsWith("export/")
  );
  await createDeterministicZip(zipPath, exportDir, files);
  const checksum = await hashZip(zipPath);

  return {
    buildId,
    status: "PASS",
    exportDir: exportRoot,
    zipPath,
    checksum,
  };
}
