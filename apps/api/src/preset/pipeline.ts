import { createHash } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import {
  generateGameSpecFromPresetWithMeta,
  validateGameSpec,
  validatePreset,
  type GameSpec,
  type Preset,
} from "@ai-studio/core";
import { assembleFromSpec } from "../assembly/assembler.js";
import { exportBuild, type ExportResult } from "../export/exporter.js";
import { REPO_ROOT } from "../paths.js";
import { runValidation } from "../validation/service.js";

export interface PresetSpecPipelineResult {
  buildId: string;
  reportsDir: string;
  spec?: GameSpec;
  presetValid: boolean;
  validationOk: boolean;
}

export interface PresetGamePipelineResult extends PresetSpecPipelineResult {
  assemblyStatus: "PASS" | "FAIL";
  exportResult?: ExportResult;
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

async function writeJson(filePath: string, data: unknown) {
  await writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
}

function readTemplateId(input: unknown): string | null {
  if (!input || typeof input !== "object") return null;
  const meta = (input as Record<string, unknown>).meta;
  if (!meta || typeof meta !== "object") return null;
  const templateId = (meta as Record<string, unknown>).templateId;
  return typeof templateId === "string" ? templateId : null;
}

export async function runPresetSpecGeneration(
  presetInput: unknown
): Promise<PresetSpecPipelineResult> {
  const input =
    presetInput && typeof presetInput === "object" ? presetInput : {};
  const normalizedPresetInput = stableNormalize(input);
  const presetHash = hashString(JSON.stringify(normalizedPresetInput));
  const buildId = `preset-${presetHash.slice(0, 12)}`;
  const reportsDir = path.resolve(REPO_ROOT, "workspaces", buildId, "reports");
  await mkdir(reportsDir, { recursive: true });

  await writeJson(
    path.join(reportsDir, "preset-input.json"),
    normalizedPresetInput
  );
  await writeFile(
    path.join(reportsDir, "preset-hash.txt"),
    presetHash,
    "utf-8"
  );

  const presetValidation = validatePreset(normalizedPresetInput);
  if (!presetValidation.valid) {
    await writeJson(path.join(reportsDir, "gamespec.generated.json"), null);
    await writeJson(path.join(reportsDir, "gamespec.validation.json"), {
      valid: false,
      errors: presetValidation.errors || ["Preset invalido"],
    });
    await writeJson(path.join(reportsDir, "preset-resolution.json"), {
      templateRequested: readTemplateId(normalizedPresetInput),
      seedUsed: null,
      tuningApplied: null,
      specHash: null,
    });
    await writeJson(path.join(reportsDir, "generation-report.json"), {
      buildId,
      status: "FAIL",
      presetHash,
      presetValid: false,
      gamespecValid: false,
      errors: presetValidation.errors || [],
    });
    return {
      buildId,
      reportsDir,
      presetValid: false,
      validationOk: false,
    };
  }

  const preset = presetValidation.data as Preset;
  const generation = generateGameSpecFromPresetWithMeta(preset);
  await writeJson(
    path.join(reportsDir, "gamespec.generated.json"),
    generation.spec
  );

  const specValidation = validateGameSpec(generation.spec);
  await writeJson(
    path.join(reportsDir, "gamespec.validation.json"),
    specValidation
  );

  await runValidation({
    spec: generation.spec,
    buildId,
  });

  const specHashPath = path.resolve(
    REPO_ROOT,
    "workspaces",
    buildId,
    "artifacts",
    "gamespec.hash"
  );
  let specHash: string | null = null;
  try {
    specHash = (await readFile(specHashPath, "utf-8")).trim();
  } catch {
    specHash = null;
  }

  await writeJson(path.join(reportsDir, "preset-resolution.json"), {
    templateRequested: preset.meta.templateId,
    seedUsed: generation.seedString,
    tuningApplied: generation.tuning,
    specHash,
  });

  const status = specValidation.valid ? "PASS" : "FAIL";
  await writeJson(path.join(reportsDir, "generation-report.json"), {
    buildId,
    status,
    presetHash: generation.presetHash,
    presetValid: true,
    gamespecValid: specValidation.valid,
    seedUsed: generation.seedString,
    errors: specValidation.errors || [],
  });

  return {
    buildId,
    reportsDir,
    spec: generation.spec,
    presetValid: true,
    validationOk: specValidation.valid,
  };
}

export async function runPresetGame(
  presetInput: unknown,
  options: { migrateToLatest?: boolean } = {}
): Promise<PresetGamePipelineResult> {
  const generation = await runPresetSpecGeneration(presetInput);
  if (!generation.validationOk || !generation.spec) {
    return {
      ...generation,
      assemblyStatus: "FAIL",
    };
  }

  const assembly = await assembleFromSpec(generation.spec, {
    buildId: generation.buildId,
    cleanWorkspace: false,
    migrateToLatest: options.migrateToLatest,
  });

  let exportResult: ExportResult | undefined;
  if (assembly.report.status === "PASS") {
    exportResult = await exportBuild(generation.buildId);
  }

  return {
    ...generation,
    assemblyStatus: assembly.report.status,
    exportResult,
  };
}
