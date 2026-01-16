import { readFile } from "fs/promises";
import path from "path";
import {
  generateAndroidWrapperProject,
  validateAndroidWrapperSpec,
} from "@ai-studio/core";
import { REPO_ROOT } from "../paths.js";

function resolvePath(value?: string): string | null {
  if (!value) return null;
  return path.isAbsolute(value) ? value : path.resolve(REPO_ROOT, value);
}

function parseArgs(args: string[]) {
  const options: { exportZip?: string; spec?: string; out?: string } = {};
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--exportZip") {
      options.exportZip = args[i + 1];
      i += 1;
    } else if (arg === "--spec") {
      options.spec = args[i + 1];
      i += 1;
    } else if (arg === "--out") {
      options.out = args[i + 1];
      i += 1;
    }
  }
  return options;
}

try {
  const { exportZip, spec, out } = parseArgs(process.argv.slice(2));
  const exportZipPath = resolvePath(exportZip);
  const specPath = resolvePath(spec);
  const outDir = resolvePath(out);

  if (!exportZipPath || !specPath || !outDir) {
    throw new Error(
      "Uso: pnpm gen:android-wrapper --exportZip <zip> --spec <spec.json> --out <dir>"
    );
  }

  const rawSpec = await readFile(specPath, "utf-8");
  const parsedSpec = JSON.parse(rawSpec);
  const validation = validateAndroidWrapperSpec(parsedSpec);
  if (!validation.valid || !validation.data) {
    throw new Error(
      `AndroidWrapperSpec invalido: ${validation.errors?.join("; ")}`
    );
  }

  const result = await generateAndroidWrapperProject({
    exportZipPath,
    spec: validation.data,
    outDir,
  });

  process.stdout.write(`status: ${result.ok ? "PASS" : "FAIL"}\n`);
  process.stdout.write(`project: ${result.projectDir}\n`);
  process.stdout.write(`report: ${result.reportPath}\n`);
  process.stdout.write(`checksums: ${result.checksumPath}\n`);

  if (!result.ok) {
    process.exitCode = 2;
  }
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`${message}\n`);
  process.exitCode = 2;
}
