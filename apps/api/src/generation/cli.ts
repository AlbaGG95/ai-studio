import { readFile } from "fs/promises";
import path from "path";
import { generateModule } from "./generator.js";
import { REPO_ROOT } from "../paths.js";

const inputPath =
  process.argv[2] ||
  path.resolve(REPO_ROOT, "examples", "generation", "request.json");

const raw = await readFile(inputPath, "utf-8");
const payload = JSON.parse(raw);
const input = payload?.input || payload;

const result = await generateModule(input);
const reportPath = path.resolve(
  REPO_ROOT,
  "workspaces",
  result.buildId,
  "reports",
  "validation-report.json"
);

const status = result.validationOk ? "PASS" : "FAIL";
process.stdout.write(`buildId: ${result.buildId}\n`);
process.stdout.write(`status: ${status}\n`);
process.stdout.write(`report: ${reportPath}\n`);

if (!result.validationOk) {
  process.exitCode = 2;
}
