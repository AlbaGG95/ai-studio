import { readFile } from "fs/promises";
import path from "path";
import { assembleFromSpec } from "./assembler.js";
import { REPO_ROOT } from "../paths.js";

try {
  const args = process.argv.slice(2);
  let inputArg: string | undefined;
  let migrateToLatest = false;
  for (const arg of args) {
    if (arg === "--migrate-to-latest") {
      migrateToLatest = true;
    } else if (!inputArg) {
      inputArg = arg;
    }
  }

  const specPath = inputArg
    ? path.isAbsolute(inputArg)
      ? inputArg
      : path.resolve(REPO_ROOT, inputArg)
    : path.resolve(REPO_ROOT, "examples", "assembly", "gamespec.json");

  const raw = await readFile(specPath, "utf-8");
  const spec = JSON.parse(raw);

  const { report, reportsDir } = await assembleFromSpec(spec, {
    migrateToLatest,
  });
  process.stdout.write(`buildId: ${report.buildId}\n`);
  process.stdout.write(`status: ${report.status}\n`);
  process.stdout.write(`reports: ${reportsDir}\n`);

  if (report.status !== "PASS") {
    process.exitCode = 2;
  }
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`${message}\n`);
  process.exitCode = 2;
}
