import { createHash } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import {
  validatePreset,
  type Preset,
  type PresetValidationResult,
} from "@ai-studio/core";
import { REPO_ROOT } from "../paths.js";
import { runPresetGame } from "../preset/pipeline.js";
import { buildPresetPrompt } from "./prompt.js";
import { getPresetProvider } from "./providers/index.js";
import type { PresetProvider } from "./providers/types.js";

export interface AiPresetAttempt {
  index: number;
  valid: boolean;
  errors: string[];
  provider: string;
  model?: string;
}

export interface AiPresetResult {
  buildId: string;
  reportsDir: string;
  preset?: Preset;
  status: "PASS" | "FAIL";
  retries: number;
  attempts: AiPresetAttempt[];
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

function buildIdForPrompt(prompt: string, provider: PresetProvider): string {
  const normalized = stableNormalize({
    prompt,
    provider: provider.name,
    model: provider.model || null,
  });
  const hash = hashString(JSON.stringify(normalized));
  return `ai-${hash.slice(0, 12)}`;
}

async function writeJson(filePath: string, data: unknown) {
  await writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
}

function parseRawPreset(raw: string): { preset: unknown; error?: string } {
  try {
    return { preset: JSON.parse(raw) };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid JSON";
    return { preset: null, error: message };
  }
}

function validatePresetPayload(
  payload: unknown,
  parseError?: string
): PresetValidationResult {
  if (parseError) {
    return { valid: false, errors: [`JSON invalido: ${parseError}`] };
  }
  return validatePreset(payload);
}

export interface AiPresetOptions {
  provider?: PresetProvider;
  maxRetries?: number;
  migrateToLatest?: boolean;
}

async function generatePresetWithRetries(
  prompt: string,
  provider: PresetProvider,
  maxRetries: number
): Promise<{
  preset: Preset | null;
  raw: string;
  attempts: AiPresetAttempt[];
  lastValidation: PresetValidationResult;
}> {
  const attempts: AiPresetAttempt[] = [];
  let lastErrors: string[] = [];
  let lastRaw = "";
  let lastValidation: PresetValidationResult = { valid: false, errors: [] };
  let preset: Preset | null = null;

  for (let index = 0; index <= maxRetries; index += 1) {
    const attemptPrompt = buildPresetPrompt(prompt, index > 0 ? lastErrors : []);
    try {
      const result = await provider.generatePreset(attemptPrompt);
      lastRaw = result.raw;

      const parsed =
        result.preset && typeof result.preset === "object"
          ? { preset: result.preset }
          : parseRawPreset(result.raw);
      const parseError =
        result.preset && typeof result.preset === "object"
          ? undefined
          : (parsed as { error?: string }).error;
      lastValidation = validatePresetPayload(parsed.preset, parseError);

      const errors = lastValidation.errors || [];
      attempts.push({
        index,
        valid: lastValidation.valid,
        errors,
        provider: result.provider,
        model: result.model,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Provider error";
      lastRaw = "";
      lastValidation = { valid: false, errors: [`Provider error: ${message}`] };
      attempts.push({
        index,
        valid: false,
        errors: lastValidation.errors || [],
        provider: provider.name,
        model: provider.model,
      });
    }

    const errors = lastValidation.errors || [];
    if (lastValidation.valid) {
      preset = lastValidation.data as Preset;
      break;
    }
    lastErrors = errors;
  }

  return {
    preset,
    raw: lastRaw,
    attempts,
    lastValidation,
  };
}

export async function runAiPresetGeneration(
  prompt: string,
  options: AiPresetOptions = {}
): Promise<AiPresetResult> {
  const provider = options.provider || getPresetProvider();
  const maxRetries = options.maxRetries ?? 2;
  const buildId = buildIdForPrompt(prompt, provider);
  const reportsDir = path.resolve(REPO_ROOT, "workspaces", buildId, "reports");
  await mkdir(reportsDir, { recursive: true });

  const generation = await generatePresetWithRetries(
    prompt,
    provider,
    maxRetries
  );

  const status: "PASS" | "FAIL" = generation.preset ? "PASS" : "FAIL";
  const retries = generation.attempts.length - 1;

  await writeJson(path.join(reportsDir, "ai-input.json"), {
    prompt,
    provider: provider.name,
    model: provider.model || null,
    seed: generation.preset?.seed ?? null,
  });

  await writeFile(
    path.join(reportsDir, "ai-output.raw.txt"),
    generation.raw || "",
    "utf-8"
  );

  await writeJson(
    path.join(reportsDir, "ai-validation.json"),
    generation.lastValidation
  );

  await writeJson(path.join(reportsDir, "ai-report.json"), {
    buildId,
    status,
    retries,
    attempts: generation.attempts,
    reason: status === "PASS" ? null : "validation-failed",
  });

  if (!generation.preset) {
    return {
      buildId,
      reportsDir,
      status: "FAIL",
      retries,
      attempts: generation.attempts,
    };
  }

  await writeJson(
    path.join(reportsDir, "ai-preset.json"),
    generation.preset
  );

  return {
    buildId,
    reportsDir,
    status: "PASS",
    retries,
    attempts: generation.attempts,
    preset: generation.preset,
  };
}

export async function runAiGameGeneration(
  prompt: string,
  options: AiPresetOptions = {}
): Promise<AiPresetResult & { exportPath?: string; checksum?: string }> {
  const provider = options.provider || getPresetProvider();
  const maxRetries = options.maxRetries ?? 2;
  const buildId = buildIdForPrompt(prompt, provider);
  const reportsDir = path.resolve(REPO_ROOT, "workspaces", buildId, "reports");
  await mkdir(reportsDir, { recursive: true });

  const generation = await generatePresetWithRetries(
    prompt,
    provider,
    maxRetries
  );

  const status: "PASS" | "FAIL" = generation.preset ? "PASS" : "FAIL";
  const retries = generation.attempts.length - 1;

  await writeJson(path.join(reportsDir, "ai-input.json"), {
    prompt,
    provider: provider.name,
    model: provider.model || null,
    seed: generation.preset?.seed ?? null,
  });

  await writeFile(
    path.join(reportsDir, "ai-output.raw.txt"),
    generation.raw || "",
    "utf-8"
  );

  await writeJson(
    path.join(reportsDir, "ai-validation.json"),
    generation.lastValidation
  );

  if (!generation.preset) {
    await writeJson(path.join(reportsDir, "ai-report.json"), {
      buildId,
      status: "FAIL",
      retries,
      attempts: generation.attempts,
      reason: "validation-failed",
    });
    return {
      buildId,
      reportsDir,
      status: "FAIL",
      retries,
      attempts: generation.attempts,
    };
  }

  await writeJson(
    path.join(reportsDir, "ai-preset.json"),
    generation.preset
  );

  const pipeline = await runPresetGame(generation.preset, {
    buildId,
    migrateToLatest: options.migrateToLatest,
  });

  const finalStatus: "PASS" | "FAIL" =
    pipeline.validationOk && pipeline.assemblyStatus === "PASS"
      ? "PASS"
      : "FAIL";

  await writeJson(path.join(reportsDir, "ai-report.json"), {
    buildId,
    status: finalStatus,
    retries,
    attempts: generation.attempts,
    reason: finalStatus === "PASS" ? null : "pipeline-failed",
  });

  return {
    buildId,
    reportsDir,
    status: finalStatus,
    retries,
    attempts: generation.attempts,
    preset: generation.preset,
    exportPath: pipeline.exportResult?.zipPath,
    checksum: pipeline.exportResult?.checksum,
  };
}
