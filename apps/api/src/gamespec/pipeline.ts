import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { validateGameSpec, type GameSpec } from "@ai-studio/core";
import { assembleFromSpec } from "../assembly/assembler.js";
import { REPO_ROOT } from "../paths.js";
import { runValidation } from "../validation/service.js";
import { generateGameSpec } from "./generator.js";
import type { GameSpecIntent } from "./types.js";

export interface GameSpecPipelineResult {
  buildId: string;
  reportsDir: string;
  spec: GameSpec;
  defaultsApplied: string[];
  validationOk: boolean;
}

export interface GamePipelineResult extends GameSpecPipelineResult {
  assemblyStatus: "PASS" | "FAIL";
}

async function writeJson(filePath: string, data: unknown) {
  await writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
}

function readPromptText(input: unknown): string | undefined {
  if (!input || typeof input !== "object") return undefined;
  const record = input as Record<string, unknown>;
  return typeof record.promptText === "string" ? record.promptText : undefined;
}

export async function runGameSpecGeneration(
  intentInput: unknown
): Promise<GameSpecPipelineResult> {
  const generation = generateGameSpec(intentInput as GameSpecIntent);
  const reportsDir = path.resolve(
    REPO_ROOT,
    "workspaces",
    generation.buildId,
    "reports"
  );
  await mkdir(reportsDir, { recursive: true });

  await writeJson(
    path.join(reportsDir, "intent-input.json"),
    generation.normalizedIntent
  );
  await writeJson(
    path.join(reportsDir, "gamespec.generated.json"),
    generation.spec
  );

  const validation = validateGameSpec(generation.spec);
  await writeJson(
    path.join(reportsDir, "gamespec.validation.json"),
    validation
  );

  await runValidation({
    spec: generation.spec,
    buildId: generation.buildId,
  });

  await writeJson(path.join(reportsDir, "generation-report.json"), {
    buildId: generation.buildId,
    intentHash: generation.intentHash,
    promptText: readPromptText(intentInput),
    defaultsApplied: generation.defaultsApplied,
    validationOk: validation.valid,
    validationErrors: validation.errors || [],
  });

  return {
    buildId: generation.buildId,
    reportsDir,
    spec: generation.spec,
    defaultsApplied: generation.defaultsApplied,
    validationOk: validation.valid,
  };
}

export async function runGameGeneration(
  intentInput: unknown
): Promise<GamePipelineResult> {
  const generation = await runGameSpecGeneration(intentInput);
  if (!generation.validationOk) {
    return {
      ...generation,
      assemblyStatus: "FAIL",
    };
  }

  const assembly = await assembleFromSpec(generation.spec, {
    buildId: generation.buildId,
    cleanWorkspace: false,
  });

  return {
    ...generation,
    assemblyStatus: assembly.report.status,
  };
}
