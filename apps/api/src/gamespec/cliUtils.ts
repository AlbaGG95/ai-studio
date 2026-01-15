import { access } from "fs/promises";
import path from "path";
import { REPO_ROOT } from "../paths.js";

const DEFAULT_INTENT_PATH = path.join(
  "examples",
  "gamespec",
  "intent.ok.json"
);

export function resolveIntentPath(inputPath?: string): string {
  const candidate = inputPath && inputPath.length > 0 ? inputPath : DEFAULT_INTENT_PATH;
  return path.isAbsolute(candidate)
    ? candidate
    : path.resolve(REPO_ROOT, candidate);
}

export async function ensureIntentPath(resolvedPath: string): Promise<void> {
  try {
    await access(resolvedPath);
  } catch {
    throw new Error(
      `Intent file not found.\nresolvedPath: ${resolvedPath}\nHint: usa una ruta absoluta o relativa a repo root.`
    );
  }
}
