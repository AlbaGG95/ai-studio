import { existsSync } from "fs";
import { join, resolve } from "path";
import { fileURLToPath } from "url";

function findRepoRoot(startDir: string): string {
  let current = startDir;
  let lastPackageDir: string | null = null;
  for (let i = 0; i < 10; i += 1) {
    const candidate = resolve(current, "..");
    if (existsSync(join(candidate, "pnpm-workspace.yaml"))) {
      return candidate;
    }
    if (existsSync(join(candidate, "package.json"))) {
      lastPackageDir = candidate;
    }
    current = candidate;
  }
  return lastPackageDir || resolve(startDir, "..");
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = resolve(__filename, "..");

export const REPO_ROOT = findRepoRoot(__dirname);
