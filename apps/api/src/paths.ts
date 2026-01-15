import { existsSync, readFileSync } from "fs";
import { join, resolve, dirname } from "path";
import { fileURLToPath } from "url";

function hasMonorepoMarker(dir: string): boolean {
  return existsSync(join(dir, "pnpm-workspace.yaml"));
}

function hasRootPackageJson(dir: string): boolean {
  const packagePath = join(dir, "package.json");
  if (!existsSync(packagePath)) return false;
  try {
    const raw = readFileSync(packagePath, "utf-8");
    const json = JSON.parse(raw) as { name?: string };
    return json.name === "ai-studio";
  } catch {
    return false;
  }
}

export function resolveRepoRoot(startDir: string): string {
  let current = startDir;
  const tried: string[] = [];
  while (true) {
    tried.push(current);
    if (hasMonorepoMarker(current) || hasRootPackageJson(current)) {
      return current;
    }
    const parent = dirname(current);
    if (parent === current) {
      const message =
        `Repo root no encontrado. Paths intentados:\n` + tried.join("\n");
      throw new Error(message);
    }
    current = parent;
  }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = resolve(__filename, "..");

export const REPO_ROOT = resolveRepoRoot(__dirname);
