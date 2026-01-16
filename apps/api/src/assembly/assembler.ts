import { createHash } from "crypto";
import { mkdir, readFile, rm, writeFile } from "fs/promises";
import path from "path";
import {
  migrateSpecForTemplate,
  parseTemplateId,
  resolveModulesForSpec,
  runAssemblySmokeTest,
  validateGameSpec,
  type TemplateMigrationReport,
  type FeatureManifest,
  type GameSpec,
} from "@ai-studio/core";
import { runValidation } from "../validation/service.js";
import { REPO_ROOT } from "../paths.js";
import { applyIntegration } from "../validation/integrator.js";

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

function buildVersionedTemplateId(
  templateId: string,
  version: string
): GameSpec["engine"]["templateId"] {
  return `${templateId}@${version}` as GameSpec["engine"]["templateId"];
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

export interface AssemblyOptions {
  moduleBaseDir?: string;
  buildId?: string;
  workspaceDir?: string;
  cleanWorkspace?: boolean;
  migrateToLatest?: boolean;
}

export async function assembleFromSpec(
  input: unknown,
  options: AssemblyOptions = {}
): Promise<{ report: AssemblyReport; reportsDir: string }> {
  const spec = await resolveSpec(input);
  const requestedTemplateId = spec.engine.templateId;
  const normalizedSpec = stableNormalize(spec);
  const specHash = hashString(JSON.stringify(normalizedSpec));
  const buildId = options.buildId || `assembly-${specHash.slice(0, 12)}`;
  const workspaceDir =
    options.workspaceDir || path.resolve(REPO_ROOT, "workspaces", buildId);
  const reportsDir = path.join(workspaceDir, "reports");
  const assemblyDir = path.join(workspaceDir, "assembly");

  if (options.cleanWorkspace === false) {
    await rm(assemblyDir, { recursive: true, force: true });
  } else {
    await rm(workspaceDir, { recursive: true, force: true });
  }
  await mkdir(reportsDir, { recursive: true });

  await writeFile(
    path.join(reportsDir, "assembly-input.json"),
    JSON.stringify(normalizedSpec, null, 2),
    "utf-8"
  );

  const parsedTemplate = parseTemplateId(requestedTemplateId);
  const initialSelection = resolveModulesForSpec(spec);
  let resolvedSpec = spec;
  let migrationReport: TemplateMigrationReport | null = null;
  let migrated = false;
  const latestVersion = initialSelection.templateVersionLatest;
  const fromVersion = parsedTemplate.version || initialSelection.templateVersionUsed;
  if (options.migrateToLatest && fromVersion !== latestVersion) {
    const migration = migrateSpecForTemplate(spec, {
      templateId: initialSelection.templateId,
      fromVersion,
      toVersion: latestVersion,
    });
    resolvedSpec = {
      ...migration.spec,
      engine: {
        ...migration.spec.engine,
        templateId: buildVersionedTemplateId(
          initialSelection.templateId,
          latestVersion
        ),
      },
    };
    migrationReport = migration.applied;
    migrated = true;
  }

  const selection = resolveModulesForSpec(resolvedSpec);
  const resolvedTemplateId = `${selection.templateId}@${selection.templateVersionUsed}`;

  await writeFile(
    path.join(reportsDir, "template-resolution.json"),
    JSON.stringify(
      {
        requestedTemplateId,
        resolvedTemplateId,
        versionUsed: selection.templateVersionUsed,
        latestVersion: selection.templateVersionLatest,
        migrated,
        migrationReport,
      },
      null,
      2
    ),
    "utf-8"
  );
  await writeFile(
    path.join(reportsDir, "module-selection.json"),
    JSON.stringify(
      {
        templateId: selection.templateId,
        templateVersionUsed: selection.templateVersionUsed,
        templateVersionLatest: selection.templateVersionLatest,
        baseModules: selection.baseModules,
        conditionsApplied: selection.conditionsApplied,
        conditionsEvaluated: selection.conditionsEvaluated,
        finalModules: selection.modules,
      },
      null,
      2
    ),
    "utf-8"
  );
  const moduleBase =
    options.moduleBaseDir || path.resolve(REPO_ROOT, "examples", "modules");
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
    spec: resolvedSpec,
    featureManifests: manifests,
    files,
    buildId,
  });
  const validationErrors = validation.ok
    ? []
    : validation.steps
        .filter((step) => step.status === "blocked")
        .flatMap((step) =>
          (step.errors || ["blocked"]).map((error) => `${step.id}: ${error}`)
        );

  let smokeOk = false;
  let smokeAttempted = false;
  let integrationErrors: string[] = [];
  if (missingModules.length === 0 && validation.ok) {
    const integration = await applyIntegration(
      manifests,
      files,
      assemblyDir
    );
    if (!integration.ok) {
      integrationErrors = integration.errors;
    } else {
      const smoke = await runAssemblySmokeTest({
        spec: resolvedSpec,
        manifests,
        assemblyDir,
        ticks: 5,
      });
      smokeAttempted = true;
      smokeOk = smoke.ok;
      await writeFile(
        path.join(reportsDir, "runtime-smoke.json"),
        JSON.stringify({ buildId, ...smoke }, null, 2),
        "utf-8"
      );
    }
  }

  if (!smokeAttempted) {
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
              : validation.ok
                ? "integration-failed"
                : "validation-failed",
        },
        null,
        2
      ),
      "utf-8"
    );
  }

  const errors = [
    ...missingModules.map(
      (moduleId) => `Modulo requerido no disponible: ${moduleId}`
    ),
    ...validationErrors,
    ...integrationErrors,
    ...(smokeAttempted && !smokeOk
      ? ["Smoke fallo al ejecutar modulos ensamblados"]
      : []),
  ];

  const status: AssemblyReport["status"] =
    errors.length === 0 && validation.ok && smokeOk ? "PASS" : "FAIL";
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
