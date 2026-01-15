import assert from "node:assert/strict";
import test from "node:test";
import path from "path";
import { access, readFile } from "fs/promises";
import { fileURLToPath } from "url";
import { resolveRepoRoot } from "../src/paths.js";

test("resolveRepoRoot points to monorepo root", async () => {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const root = resolveRepoRoot(path.resolve(currentDir));
  await access(path.join(root, "pnpm-workspace.yaml"));
  await access(path.join(root, "package.json"));
  const raw = await readFile(path.join(root, "package.json"), "utf-8");
  const json = JSON.parse(raw) as { name?: string };
  assert.equal(json.name, "ai-studio");
});
