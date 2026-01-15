import { readFile } from "fs/promises";
import { runGameSpecGeneration } from "./pipeline.js";
import { ensureIntentPath, resolveIntentPath } from "./cliUtils.js";

try {
  const inputPath = resolveIntentPath(process.argv[2]);
  await ensureIntentPath(inputPath);
  const raw = await readFile(inputPath, "utf-8");
  const intent = JSON.parse(raw);

  const result = await runGameSpecGeneration(intent);
  const status = result.validationOk ? "PASS" : "FAIL";

  process.stdout.write(`buildId: ${result.buildId}\n`);
  process.stdout.write(`status: ${status}\n`);
  process.stdout.write(`reports: ${result.reportsDir}\n`);

  if (!result.validationOk) {
    process.exitCode = 2;
  }
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`${message}\n`);
  process.exitCode = 2;
}
