import { readFile } from "fs/promises";
import { runPresetSpecGeneration } from "./pipeline.js";
import { ensurePresetPath, resolvePresetPath } from "./cliUtils.js";

try {
  const inputPath = resolvePresetPath(process.argv[2]);
  await ensurePresetPath(inputPath);
  const raw = await readFile(inputPath, "utf-8");
  const preset = JSON.parse(raw);

  const result = await runPresetSpecGeneration(preset);
  const status = result.validationOk ? "PASS" : "FAIL";

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
