import { mkdir, writeFile } from "fs/promises";
import { createHash, randomUUID } from "crypto";
import { join, resolve } from "path";
import { REPO_ROOT } from "../paths.js";
import {
  buildManifestGraph,
  validateGameSpec,
  validateFeatureManifest,
  type FeatureManifest,
  type GameSpec,
} from "@ai-studio/core";
import { scanFilesForForbiddenApis } from "./astScan.js";
import { validateWriteOperations } from "./integrator.js";

export interface ValidationInput {
  spec: unknown;
  featureManifests?: unknown[];
  files?: ValidationFile[];
  buildId?: string;
}

export interface ValidationFile {
  moduleId?: string;
  path: string;
  content: string;
}

export type ValidationStepStatus = "ok" | "blocked";

export interface ValidationStepResult {
  id: string;
  status: ValidationStepStatus;
  errors?: string[];
}

export interface ValidationReport {
  ok: boolean;
  buildId: string;
  steps: ValidationStepResult[];
  artifacts: {
    normalizedSpecPath?: string;
    specHashPath?: string;
    featureManifestPaths?: string[];
    featureManifestHashPaths?: string[];
    dependencyGraphPath?: string;
    integrationReportPath?: string;
    securityReportPath?: string;
  };
}

const WORKSPACES_DIR = resolve(REPO_ROOT, "workspaces");

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

function isSafeRelativePath(value: string): boolean {
  if (!value || value.includes("..")) return false;
  if (value.startsWith("/") || value.startsWith("\\")) return false;
  return true;
}

function findDuplicateIds<T extends { id: string }>(items: T[]): string[] {
  const seen = new Set<string>();
  const dupes = new Set<string>();
  for (const item of items) {
    if (seen.has(item.id)) {
      dupes.add(item.id);
    }
    seen.add(item.id);
  }
  return [...dupes];
}

function validateGameSpecIntegrity(spec: GameSpec): string[] {
  const errors: string[] = [];

  const heroDupes = findDuplicateIds(spec.content.heroes);
  if (heroDupes.length) {
    errors.push(`Heroes duplicados: ${heroDupes.join(", ")}`);
  }

  const enemyDupes = findDuplicateIds(spec.content.enemies);
  if (enemyDupes.length) {
    errors.push(`Enemies duplicados: ${enemyDupes.join(", ")}`);
  }

  const stageDupes = findDuplicateIds(spec.content.stages);
  if (stageDupes.length) {
    errors.push(`Stages duplicados: ${stageDupes.join(", ")}`);
  }

  const itemDupes = findDuplicateIds(spec.content.items);
  if (itemDupes.length) {
    errors.push(`Items duplicados: ${itemDupes.join(", ")}`);
  }

  const screenDupes = findDuplicateIds(spec.ui.screens);
  if (screenDupes.length) {
    errors.push(`Screens duplicados: ${screenDupes.join(", ")}`);
  }

  const enemyIds = new Set(spec.content.enemies.map((enemy) => enemy.id));
  for (const stage of spec.content.stages) {
    for (const enemyId of stage.enemies) {
      if (!enemyIds.has(enemyId)) {
        errors.push(`Stage ${stage.id} referencia enemy inexistente: ${enemyId}`);
      }
    }
  }

  return errors;
}

function validateFeatureManifestIntegrity(
  manifests: FeatureManifest[]
): string[] {
  const errors: string[] = [];
  const moduleIds = new Set<string>();
  const providedEvents = new Set<string>();
  const providedState = new Set<string>();
  const providedCommands = new Set<string>();
  const allowedPrefixes = ["core.", "system."];

  for (const manifest of manifests) {
    if (moduleIds.has(manifest.module.id)) {
      errors.push(`Module duplicado: ${manifest.module.id}`);
    }
    moduleIds.add(manifest.module.id);

    for (const file of manifest.files) {
      if (!isSafeRelativePath(file.path)) {
        errors.push(`Path invalido en files: ${file.path}`);
      }
    }

    for (const asset of manifest.assets || []) {
      if (!isSafeRelativePath(asset.path)) {
        errors.push(`Path invalido en assets: ${asset.path}`);
      }
    }

    for (const eventName of manifest.provides.events) {
      providedEvents.add(eventName);
    }
    for (const statePath of manifest.provides.state) {
      providedState.add(statePath);
    }
    for (const commandName of manifest.provides.commands) {
      providedCommands.add(commandName);
    }
  }

  for (const manifest of manifests) {
    for (const eventName of manifest.consumes.events) {
      const allowed = allowedPrefixes.some((prefix) =>
        eventName.startsWith(prefix)
      );
      if (!allowed && !providedEvents.has(eventName)) {
        errors.push(`Evento consumido sin proveedor: ${eventName}`);
      }
    }

    for (const statePath of manifest.consumes.state) {
      const allowed = allowedPrefixes.some((prefix) =>
        statePath.startsWith(prefix)
      );
      if (!allowed && !providedState.has(statePath)) {
        errors.push(`State consumido sin proveedor: ${statePath}`);
      }
    }

    for (const commandName of manifest.consumes.commands) {
      const allowed = allowedPrefixes.some((prefix) =>
        commandName.startsWith(prefix)
      );
      if (!allowed && !providedCommands.has(commandName)) {
        errors.push(`Command consumido sin proveedor: ${commandName}`);
      }
    }
  }

  return errors;
}

async function writeJson(path: string, data: unknown) {
  await writeFile(path, JSON.stringify(data, null, 2), "utf-8");
}

export async function runValidation(
  input: ValidationInput
): Promise<ValidationReport> {
  const buildId = input.buildId || randomUUID();
  const workspace = resolve(WORKSPACES_DIR, buildId);
  const artifactsDir = join(workspace, "artifacts");
  const logsDir = join(workspace, "logs");
  const reportsDir = join(workspace, "reports");

  await mkdir(artifactsDir, { recursive: true });
  await mkdir(logsDir, { recursive: true });
  await mkdir(reportsDir, { recursive: true });

  await writeFile(
    join(logsDir, "validation.log"),
    "validation start\n",
    "utf-8"
  );

  const steps: ValidationStepResult[] = [];
  const artifacts: ValidationReport["artifacts"] = {};

  const normalizedSpec = stableNormalize(input.spec);
  const normalizedSpecJson = JSON.stringify(normalizedSpec, null, 2);
  const specHash = hashString(normalizedSpecJson);

  const normalizedSpecPath = join(artifactsDir, "gamespec.normalized.json");
  const specHashPath = join(artifactsDir, "gamespec.hash");
  await writeFile(normalizedSpecPath, normalizedSpecJson, "utf-8");
  await writeFile(specHashPath, specHash, "utf-8");
  artifacts.normalizedSpecPath = normalizedSpecPath;
  artifacts.specHashPath = specHashPath;

  const specValidation = validateGameSpec(input.spec);
  if (!specValidation.valid) {
    steps.push({
      id: "gamespec.schema",
      status: "blocked",
      errors: specValidation.errors || ["GameSpec invalido"],
    });

    const report: ValidationReport = {
      ok: false,
      buildId,
      steps,
      artifacts,
    };
    await writeJson(join(reportsDir, "validation-report.json"), report);
    return report;
  }

  steps.push({ id: "gamespec.schema", status: "ok" });

  const specIntegrityErrors = validateGameSpecIntegrity(
    specValidation.data as GameSpec
  );
  if (specIntegrityErrors.length) {
    steps.push({
      id: "gamespec.integrity",
      status: "blocked",
      errors: specIntegrityErrors,
    });

    const report: ValidationReport = {
      ok: false,
      buildId,
      steps,
      artifacts,
    };
    await writeJson(join(reportsDir, "validation-report.json"), report);
    return report;
  }

  steps.push({ id: "gamespec.integrity", status: "ok" });

  const manifestInputs = input.featureManifests || [];
  const manifestPaths: string[] = [];
  const manifestHashPaths: string[] = [];
  const manifestModels: FeatureManifest[] = [];

  if (manifestInputs.length > 0) {
    for (let index = 0; index < manifestInputs.length; index += 1) {
      const manifest = manifestInputs[index];
      const normalizedManifest = stableNormalize(manifest);
      const normalizedManifestJson = JSON.stringify(normalizedManifest, null, 2);
      const manifestHash = hashString(normalizedManifestJson);
      const manifestPath = join(
        artifactsDir,
        `feature-manifest.${index + 1}.normalized.json`
      );
      const manifestHashPath = join(
        artifactsDir,
        `feature-manifest.${index + 1}.hash`
      );

      await writeFile(manifestPath, normalizedManifestJson, "utf-8");
      await writeFile(manifestHashPath, manifestHash, "utf-8");

      manifestPaths.push(manifestPath);
      manifestHashPaths.push(manifestHashPath);

      const validation = validateFeatureManifest(manifest);
      if (!validation.valid) {
        steps.push({
          id: `feature-manifest.${index + 1}.schema`,
          status: "blocked",
          errors: validation.errors || ["Feature Manifest invalido"],
        });

        const report: ValidationReport = {
          ok: false,
          buildId,
          steps,
          artifacts: {
            ...artifacts,
            featureManifestPaths: manifestPaths,
            featureManifestHashPaths: manifestHashPaths,
          },
        };
        await writeJson(join(reportsDir, "validation-report.json"), report);
        return report;
      }

      steps.push({ id: `feature-manifest.${index + 1}.schema`, status: "ok" });
      manifestModels.push(validation.data as FeatureManifest);
    }

    const manifestIntegrityErrors = validateFeatureManifestIntegrity(
      manifestModels
    );
    if (manifestIntegrityErrors.length) {
      steps.push({
        id: "feature-manifest.integrity",
        status: "blocked",
        errors: manifestIntegrityErrors,
      });

      const report: ValidationReport = {
        ok: false,
        buildId,
        steps,
        artifacts: {
          ...artifacts,
          featureManifestPaths: manifestPaths,
          featureManifestHashPaths: manifestHashPaths,
        },
      };
      await writeJson(join(reportsDir, "validation-report.json"), report);
      return report;
    }

    steps.push({ id: "feature-manifest.integrity", status: "ok" });
  }

  if (manifestModels.length > 0) {
    const graph = buildManifestGraph(manifestModels, {
      allowlistPrefixes: ["core.", "system."],
    });
    const graphPath = join(reportsDir, "dependency-graph.json");
    await writeJson(graphPath, graph);
    artifacts.dependencyGraphPath = graphPath;

    if (graph.missing.length > 0 || graph.cycles.length > 0) {
      const errors: string[] = [];
      if (graph.missing.length > 0) {
        errors.push(
          `Dependencias no satisfechas: ${graph.missing.length}`
        );
      }
      if (graph.cycles.length > 0) {
        errors.push(`Ciclos detectados: ${graph.cycles.length}`);
      }
      steps.push({ id: "feature-manifest.graph", status: "blocked", errors });
      const report: ValidationReport = {
        ok: false,
        buildId,
        steps,
        artifacts: {
          ...artifacts,
          featureManifestPaths: manifestPaths.length ? manifestPaths : undefined,
          featureManifestHashPaths: manifestHashPaths.length
            ? manifestHashPaths
            : undefined,
        },
      };
      await writeJson(join(reportsDir, "validation-report.json"), report);
      return report;
    }

    steps.push({ id: "feature-manifest.graph", status: "ok" });
  }

  const files = input.files || [];
  if (files.length > 0 && manifestModels.length > 0) {
    const missingModuleErrors = files
      .filter((file) => !file.moduleId)
      .map((file) => `Write sin moduleId: ${file.path}`);
    const writeErrors = [
      ...missingModuleErrors,
      ...validateWriteOperations(
        manifestModels,
        files
          .filter((file) => typeof file.moduleId === "string")
          .map((file) => ({
            moduleId: file.moduleId as string,
            path: file.path,
          }))
      ),
    ];
    const integrationReportPath = join(
      reportsDir,
      "integration-report.json"
    );
    await writeJson(integrationReportPath, {
      ok: writeErrors.length === 0,
      errors: writeErrors,
    });
    artifacts.integrationReportPath = integrationReportPath;

    if (writeErrors.length > 0) {
      steps.push({
        id: "feature-manifest.integration",
        status: "blocked",
        errors: writeErrors,
      });
      const report: ValidationReport = {
        ok: false,
        buildId,
        steps,
        artifacts: {
          ...artifacts,
          featureManifestPaths: manifestPaths.length ? manifestPaths : undefined,
          featureManifestHashPaths: manifestHashPaths.length
            ? manifestHashPaths
            : undefined,
        },
      };
      await writeJson(join(reportsDir, "validation-report.json"), report);
      return report;
    }

    steps.push({ id: "feature-manifest.integration", status: "ok" });
  }

  if (files.length > 0) {
    const astViolations = scanFilesForForbiddenApis(
      files.map((file) => ({ path: file.path, content: file.content }))
    );
    const securityReportPath = join(reportsDir, "security-report.json");
    await writeJson(securityReportPath, {
      ok: astViolations.length === 0,
      astScan: {
        ok: astViolations.length === 0,
        violations: astViolations,
      },
    });
    artifacts.securityReportPath = securityReportPath;

    if (astViolations.length > 0) {
      steps.push({
        id: "security.ast-scan",
        status: "blocked",
        errors: astViolations.map(
          (violation) =>
            `${violation.file}:${violation.line}:${violation.column} ${violation.message}`
        ),
      });
      const report: ValidationReport = {
        ok: false,
        buildId,
        steps,
        artifacts: {
          ...artifacts,
          featureManifestPaths: manifestPaths.length ? manifestPaths : undefined,
          featureManifestHashPaths: manifestHashPaths.length
            ? manifestHashPaths
            : undefined,
        },
      };
      await writeJson(join(reportsDir, "validation-report.json"), report);
      return report;
    }

    steps.push({ id: "security.ast-scan", status: "ok" });
  }

  const report: ValidationReport = {
    ok: true,
    buildId,
    steps,
    artifacts: {
      ...artifacts,
      featureManifestPaths: manifestPaths.length ? manifestPaths : undefined,
      featureManifestHashPaths: manifestHashPaths.length
        ? manifestHashPaths
        : undefined,
    },
  };
  await writeJson(join(reportsDir, "validation-report.json"), report);
  return report;
}
