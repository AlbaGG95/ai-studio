import { readFile } from "fs/promises";
import { runGameGeneration } from "./pipeline.js";
import { ensureIntentPath, resolveIntentPath } from "./cliUtils.js";

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

  const inputPath = resolveIntentPath(inputArg);
  await ensureIntentPath(inputPath);
  const raw = await readFile(inputPath, "utf-8");
  const intent = JSON.parse(raw);

  const result = await runGameGeneration(intent, { migrateToLatest });
  const status =
    result.validationOk && result.assemblyStatus === "PASS" ? "PASS" : "FAIL";

  process.stdout.write(`buildId: ${result.buildId}\n`);
  process.stdout.write(`status: ${status}\n`);
  process.stdout.write(`reports: ${result.reportsDir}\n`);

  if (status !== "PASS") {
    process.exitCode = 2;
  }
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`${message}\n`);
  process.exitCode = 2;
}
