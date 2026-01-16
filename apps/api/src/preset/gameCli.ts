import { readFile } from "fs/promises";
import { ensurePresetPath, resolvePresetPath } from "./cliUtils.js";
import { runPresetGame } from "./pipeline.js";

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

  const inputPath = resolvePresetPath(inputArg);
  await ensurePresetPath(inputPath);
  const raw = await readFile(inputPath, "utf-8");
  const preset = JSON.parse(raw);

  const result = await runPresetGame(preset, { migrateToLatest });
  const status =
    result.validationOk && result.assemblyStatus === "PASS" ? "PASS" : "FAIL";

  process.stdout.write(`buildId: ${result.buildId}\n`);
  process.stdout.write(`status: ${status}\n`);
  process.stdout.write(
    `export: ${result.exportResult?.zipPath ?? "n/a"}\n`
  );
  process.stdout.write(
    `checksum: ${result.exportResult?.checksum ?? "n/a"}\n`
  );

  if (status !== "PASS") {
    process.exitCode = 2;
  }
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`${message}\n`);
  process.exitCode = 2;
}
