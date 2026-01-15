import { readFile } from "fs/promises";
import path from "path";
import { assembleFromSpec } from "./assembler.js";
import { REPO_ROOT } from "../paths.js";

const specPath =
  process.argv[2] ||
  path.resolve(REPO_ROOT, "examples", "assembly", "gamespec.json");

const raw = await readFile(specPath, "utf-8");
const spec = JSON.parse(raw);

const { report, reportsDir } = await assembleFromSpec(spec);
process.stdout.write(`buildId: ${report.buildId}\n`);
process.stdout.write(`status: ${report.status}\n`);
process.stdout.write(`reports: ${reportsDir}\n`);

if (report.status !== "PASS") {
  process.exitCode = 2;
}
