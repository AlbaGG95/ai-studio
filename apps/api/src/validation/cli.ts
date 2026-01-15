import { readFile } from "fs/promises";
import { resolve } from "path";
import { REPO_ROOT } from "../paths.js";
import { runValidation } from "./service.js";

const specPath =
  process.argv[2] ||
  resolve(REPO_ROOT, "packages", "core", "spec", "example.spec.json");

const raw = await readFile(specPath, "utf-8");
const spec = JSON.parse(raw);

const report = await runValidation({ spec });
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
