import { createHash } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import {
  type FeatureFileRole,
  type FeatureManifest,
  validateFeatureManifest,
} from "@ai-studio/core";
import { REPO_ROOT } from "../paths.js";
import { runValidation } from "../validation/service.js";
import type {
  GenerationFileRecord,
  GenerationResult,
  ModuleGenerationInput,
  ModuleGenerationFile,
} from "./types.js";

const DEFAULT_SPEC_PATH = path.resolve(
  REPO_ROOT,
  "packages",
  "core",
  "spec",
  "example.spec.json"
);

const ROLE_BY_KIND: Record<string, FeatureFileRole> = {
  system: "logic",
  renderer: "render",
  ui: "ui",
};

function stableNormalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stableNormalize);
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return Object.keys(record)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = stableNormalize(record[key]);
        return acc;
      }, {});
  }
  return value;
}

function hashString(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function normalizePath(value: string) {
  return value.replace(/\\/g, "/").replace(/^\.\/+/, "");
}

function isSafeRelativePath(value: string) {
  if (!value || value.includes("..")) return false;
  if (value.startsWith("/") || value.startsWith("\\")) return false;
  return true;
}

function buildEntryPath(moduleId: string) {
  return `modules/${moduleId}/index.ts`;
}

function buildDefaultFileContent(moduleId: string) {
  return `export const ${moduleId.replace(/-/g, "_")} = () => "ok";\n`;
}

function normalizeFiles(
  files: ModuleGenerationFile[],
  moduleId: string,
  entryPath: string,
  kind: string
) {
  const normalized = files.map((file) => ({
    path: normalizePath(file.path),
    content: file.content,
    role: file.role || ROLE_BY_KIND[kind] || "logic",
  }));

  if (!normalized.some((file) => file.path === entryPath)) {
    normalized.push({
      path: entryPath,
      content: buildDefaultFileContent(moduleId),
      role: ROLE_BY_KIND[kind] || "logic",
    });
  }

  normalized.sort((a, b) => a.path.localeCompare(b.path));
  return normalized;
}

async function loadDefaultSpec() {
  const raw = await readFile(DEFAULT_SPEC_PATH, "utf-8");
  return JSON.parse(raw);
}

export async function generateModule(
  input: ModuleGenerationInput
): Promise<GenerationResult> {
  if (!input?.module?.id || !input?.module?.kind) {
    throw new Error("module.id y module.kind son requeridos");
  }

  const normalizedInput = stableNormalize(input);
  const inputHash = hashString(JSON.stringify(normalizedInput));
  const generationId = `gen-${inputHash.slice(0, 12)}`;
  const buildId = generationId;
  const entryPath = normalizePath(
    input.module.entry || buildEntryPath(input.module.id)
  );

  if (!isSafeRelativePath(entryPath)) {
    throw new Error(`entry path invalido: ${entryPath}`);
  }

  const files = normalizeFiles(
    input.files || [],
    input.module.id,
    entryPath,
    input.module.kind
  );

  for (const file of files) {
    if (!isSafeRelativePath(file.path)) {
      throw new Error(`file path invalido: ${file.path}`);
    }
  }

  const manifest: FeatureManifest = {
    version: "1.0",
    module: {
      id: input.module.id,
      name: input.module.name || input.module.id,
      kind: input.module.kind,
      entry: entryPath,
      templateId: input.module.templateId || "idle-rpg-base",
    },
    provides: {
      events: input.provides?.events || [],
      state: input.provides?.state || [],
      commands: input.provides?.commands || [],
    },
    consumes: {
      events: input.consumes?.events || [],
      state: input.consumes?.state || [],
      commands: input.consumes?.commands || [],
    },
    files: files.map((file) => ({
      path: file.path,
      role: file.role || ROLE_BY_KIND[input.module.kind] || "logic",
      sha256: hashString(file.content),
    })),
    constraints: input.constraints,
  };

  const manifestValidation = validateFeatureManifest(manifest);
  if (!manifestValidation.valid) {
    throw new Error(
      `Feature Manifest invalido: ${manifestValidation.errors?.join("; ")}`
    );
  }

  const stagingDir = path.resolve(REPO_ROOT, "staging", generationId);
  const filesDir = path.join(stagingDir, "files");
  await mkdir(filesDir, { recursive: true });

  const manifestPath = path.join(stagingDir, "manifest.json");
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2), "utf-8");

  const fileRecords: GenerationFileRecord[] = [];
  for (const file of files) {
    const target = path.resolve(filesDir, file.path);
    if (!target.startsWith(`${filesDir}${path.sep}`) && target !== filesDir) {
      throw new Error(`write fuera de staging: ${file.path}`);
    }
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, file.content, "utf-8");
    fileRecords.push({
      path: file.path,
      role: file.role || ROLE_BY_KIND[input.module.kind] || "logic",
      sha256: hashString(file.content),
      sizeBytes: Buffer.byteLength(file.content, "utf-8"),
    });
  }

  const reportsDir = path.resolve(
    REPO_ROOT,
    "workspaces",
    buildId,
    "reports"
  );
  await mkdir(reportsDir, { recursive: true });

  await writeFile(
    path.join(reportsDir, "generation-input.json"),
    JSON.stringify(normalizedInput, null, 2),
    "utf-8"
  );
  await writeFile(
    path.join(reportsDir, "generated-manifest.json"),
    JSON.stringify(manifest, null, 2),
    "utf-8"
  );

  const spec = input.spec || (await loadDefaultSpec());
  const validation = await runValidation({
    spec,
    featureManifests: [manifest],
    files: files.map((file) => ({
      moduleId: manifest.module.id,
      path: file.path,
      content: file.content,
    })),
    buildId,
  });

  const blockedSteps = validation.steps.filter(
    (step) => step.status === "blocked"
  );
  await writeFile(
    path.join(reportsDir, "generation-report.json"),
    JSON.stringify(
      {
        generationId,
        buildId,
        stagingDir,
        manifestPath,
        filesDir,
        files: fileRecords,
        validationOk: validation.ok,
        blockedSteps,
      },
      null,
      2
    ),
    "utf-8"
  );

  return {
    generationId,
    buildId,
    manifestPath,
    filesDir,
    files: fileRecords,
    validationOk: validation.ok,
  };
}
