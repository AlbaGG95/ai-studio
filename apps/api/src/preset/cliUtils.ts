import { access } from "fs/promises";
import path from "path";
import { REPO_ROOT } from "../paths.js";

const DEFAULT_PRESET_PATH = path.join(
  "examples",
  "presets",
  "preset.fast.json"
);

export function resolvePresetPath(inputPath?: string): string {
  const candidate =
    inputPath && inputPath.length > 0 ? inputPath : DEFAULT_PRESET_PATH;
  return path.isAbsolute(candidate)
    ? candidate
    : path.resolve(REPO_ROOT, candidate);
}

export async function ensurePresetPath(resolvedPath: string): Promise<void> {
  try {
    await access(resolvedPath);
  } catch {
    throw new Error(
      `Preset file not found.\nresolvedPath: ${resolvedPath}\nHint: usa una ruta absoluta o relativa a repo root.`
    );
  }
}
