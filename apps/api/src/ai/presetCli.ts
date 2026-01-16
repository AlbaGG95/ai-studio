import { runAiPresetGeneration } from "./pipeline.js";

function readPrompt(args: string[]): string {
  const prompt = args.join(" ").trim();
  if (!prompt) {
    throw new Error("Prompt requerido. Uso: pnpm gen:ai-preset \"<prompt>\"");
  }
  return prompt;
}

try {
  const prompt = readPrompt(process.argv.slice(2));
  const result = await runAiPresetGeneration(prompt);

  process.stdout.write(`buildId: ${result.buildId}\n`);
  process.stdout.write(`status: ${result.status}\n`);
  process.stdout.write(`reports: ${result.reportsDir}\n`);

  if (result.status !== "PASS") {
    process.exitCode = 2;
  }
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`${message}\n`);
  process.exitCode = 2;
}
