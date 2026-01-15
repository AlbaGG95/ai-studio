import { createHash } from "crypto";
import { mkdir, readFile, rm, writeFile } from "fs/promises";
import path from "path";
import {
  resolveModulesForSpec,
  runSmokeTest,
  validateGameSpec,
  type FeatureManifest,
  type GameSpec,
} from "@ai-studio/core";
import { runValidation } from "../validation/service.js";
import { REPO_ROOT } from "../paths.js";

export interface AssemblyPlanModule {
  id: string;
  manifestPath: string;
  manifestSha256: string;
}

export interface AssemblyPlan {
  version: "1.0";
  specHash: string;
  modules: AssemblyPlanModule[];
  integrationOrder: string[];
}

export interface AssemblyReport {
  status: "PASS" | "FAIL";
  buildId: string;
  errors: string[];
  validationOk: boolean;
  smokeOk: boolean;
}

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

function resolveModuleFile(
  moduleDir: string,
  moduleId: string,
  manifestPath: string
) {
  const normalized = normalizePath(manifestPath);
  const prefix = `modules/${moduleId}/`;
  if (normalized.startsWith(prefix)) {
    return path.join(moduleDir, normalized.slice(prefix.length));
  }
  return path.join(moduleDir, normalized);
}

async function loadManifest(
  moduleId: string,
  baseDir: string
): Promise<FeatureManifest> {
  const manifestPath = path.join(baseDir, "feature-manifest.json");
  const raw = await readFile(manifestPath, "utf-8");
  const manifest = JSON.parse(raw) as FeatureManifest;
  if (manifest.module.id !== moduleId) {
    throw new Error(`Manifest id mismatch: ${manifest.module.id}`);
  }
  return manifest;
}

async function resolveSpec(input: unknown): Promise<GameSpec> {
  const validation = validateGameSpec(input);
  if (!validation.valid || !validation.data) {
    throw new Error(`GameSpec invalido: ${validation.errors?.join("; ")}`);
  }
  return validation.data;
}

export async function assembleFromSpec(
  input: unknown
): Promise<{ report: AssemblyReport; reportsDir: string }> {
  const spec = await resolveSpec(input);
  const normalizedSpec = stableNormalize(spec);
  const specHash = hashString(JSON.stringify(normalizedSpec));
  const buildId = `assembly-${specHash.slice(0, 12)}`;
  const workspaceDir = path.resolve(REPO_ROOT, "workspaces", buildId);
  const reportsDir = path.join(workspaceDir, "reports");
  const assemblyDir = path.join(workspaceDir, "assembly");

  await rm(workspaceDir, { recursive: true, force: true });
  await mkdir(reportsDir, { recursive: true });

  await writeFile(
    path.join(reportsDir, "assembly-input.json"),
    JSON.stringify(normalizedSpec, null, 2),
    "utf-8"
  );

  const selection = resolveModulesForSpec(spec);
  const moduleBase = path.resolve(REPO_ROOT, "examples", "modules");
  const missingModules: string[] = [];
  const manifests: FeatureManifest[] = [];
  const planModules: AssemblyPlanModule[] = [];

  for (const moduleId of selection.modules) {
    const moduleDir = path.join(moduleBase, moduleId);
    const manifestPath = path.join(moduleDir, "feature-manifest.json");
    try {
      const manifest = await loadManifest(moduleId, moduleDir);
      const manifestRaw = await readFile(manifestPath, "utf-8");
      manifests.push(manifest);
      planModules.push({
        id: moduleId,
        manifestPath: path.relative(REPO_ROOT, manifestPath),
        manifestSha256: hashString(manifestRaw),
      });
    } catch {
      missingModules.push(moduleId);
    }
  }

  const plan: AssemblyPlan = {
    version: "1.0",
    specHash,
    modules: planModules,
    integrationOrder: selection.modules,
  };

  await writeFile(
    path.join(reportsDir, "assembly-plan.json"),
    JSON.stringify(plan, null, 2),
    "utf-8"
  );

  const files: { moduleId: string; path: string; content: string }[] = [];
  for (const manifest of manifests) {
    const moduleDir = path.join(moduleBase, manifest.module.id);
    for (const file of manifest.files) {
      const sourcePath = resolveModuleFile(
        moduleDir,
        manifest.module.id,
        file.path
      );
      const content = await readFile(sourcePath, "utf-8");
      files.push({
        moduleId: manifest.module.id,
        path: file.path,
        content,
      });
    }
  }

  const validation = await runValidation({
    spec,
    featureManifests: manifests,
    files,
    buildId,
  });

  let smokeOk = false;
  if (missingModules.length === 0 && validation.ok) {
    await mkdir(assemblyDir, { recursive: true });
    for (const file of files) {
      const target = path.resolve(assemblyDir, file.path);
      if (!target.startsWith(`${assemblyDir}${path.sep}`) && target !== assemblyDir) {
        throw new Error(`write fuera de assembly: ${file.path}`);
      }
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, file.content, "utf-8");
    }

    const smoke = await runSmokeTest(5);
    smokeOk = smoke.ok;
    await writeFile(
      path.join(reportsDir, "runtime-smoke.json"),
      JSON.stringify({ buildId, ...smoke }, null, 2),
      "utf-8"
    );
  } else {
    await writeFile(
      path.join(reportsDir, "runtime-smoke.json"),
      JSON.stringify(
        {
          buildId,
          ok: false,
          skipped: true,
          reason:
            missingModules.length > 0
              ? "missing-modules"
              : "validation-failed",
        },
        null,
        2
      ),
      "utf-8"
    );
  }

  const errors = missingModules.map(
    (moduleId) => `Modulo requerido no disponible: ${moduleId}`
  );

  const status: AssemblyReport["status"] =
    errors.length === 0 && validation.ok ? "PASS" : "FAIL";
  const report: AssemblyReport = {
    status,
    buildId,
    errors,
    validationOk: validation.ok,
    smokeOk,
  };

  await writeFile(
    path.join(reportsDir, "assembly-report.json"),
    JSON.stringify(report, null, 2),
    "utf-8"
  );

  return { report, reportsDir };
}
