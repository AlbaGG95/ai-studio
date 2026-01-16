import { runAiGameGeneration } from "./pipeline.js";

function readPrompt(args: string[]): { prompt: string; migrateToLatest: boolean } {
  let migrateToLatest = false;
  const parts: string[] = [];
  for (const arg of args) {
    if (arg === "--migrate-to-latest") {
      migrateToLatest = true;
    } else {
      parts.push(arg);
    }
  }
  const prompt = parts.join(" ").trim();
  if (!prompt) {
    throw new Error("Prompt requerido. Uso: pnpm gen:ai-game \"<prompt>\"");
  }
  return { prompt, migrateToLatest };
}

try {
  const { prompt, migrateToLatest } = readPrompt(process.argv.slice(2));
  const result = await runAiGameGeneration(prompt, { migrateToLatest });

  process.stdout.write(`buildId: ${result.buildId}\n`);
  process.stdout.write(`status: ${result.status}\n`);
  process.stdout.write(`export: ${result.exportPath ?? "n/a"}\n`);
  process.stdout.write(`checksum: ${result.checksum ?? "n/a"}\n`);

  if (result.status !== "PASS") {
    process.exitCode = 2;
  }
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`${message}\n`);
  process.exitCode = 2;
}
