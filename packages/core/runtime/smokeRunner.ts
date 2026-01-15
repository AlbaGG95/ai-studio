import { existsSync } from "fs";
import { mkdir, writeFile } from "fs/promises";
import { randomUUID } from "crypto";
import { join, resolve } from "path";
import { pathToFileURL } from "url";
import { Runtime } from "./runtime.js";
import type { Logger, RuntimeModule } from "./types.js";

type DummySpec = { name: string };
type DummyEvents = { "dummy.tick": { tick: number } };

type DummyAction = { type: "inc"; value: number };

function createLogger(buffer: string[]): Logger {
  return {
    info: (message) => buffer.push(`info: ${message}`),
    warn: (message) => buffer.push(`warn: ${message}`),
    error: (message) => buffer.push(`error: ${message}`),
    debug: (message) => buffer.push(`debug: ${message}`),
  };
}

function createDummyModule(): RuntimeModule<DummySpec, DummyEvents> {
  return {
    id: "dummy-module",
    init: (ctx) => {
      ctx.state.registerSlice("dummy", { ticks: 0 }, (state, action: DummyAction) => {
        if (action.type === "inc") {
          return { ...state, ticks: state.ticks + action.value };
        }
        return state;
      });
      ctx.logger.info("dummy init");
    },
    start: (ctx) => {
      ctx.logger.info("dummy start");
    },
    tick: (ctx, dtMs) => {
      ctx.state.dispatch("dummy", { type: "inc", value: 1 });
      ctx.events.emit("dummy.tick", { tick: dtMs });
    },
    stop: (ctx) => {
      ctx.logger.info("dummy stop");
    },
    dispose: (ctx) => {
      ctx.logger.info("dummy dispose");
    },
  };
}

function findRepoRoot(startDir: string): string {
  let current = startDir;
  for (let i = 0; i < 10; i += 1) {
    const candidate = resolve(current, "..");
    if (candidate === current) break;
    if (candidate && existsSync(join(candidate, "pnpm-workspace.yaml"))) {
      return candidate;
    }
    current = candidate;
  }
  return startDir;
}

export async function runSmokeTest(ticks = 5) {
  const logs: string[] = [];
  const logger = createLogger(logs);
  const runtime = new Runtime<DummySpec, DummyEvents>({ name: "Dummy" }, logger, 42);
  const module = createDummyModule();
  runtime.register(module);

  const startedAt = Date.now();
  let ok = true;
  let error: string | null = null;

  try {
    runtime.init();
    runtime.start();
    for (let i = 0; i < ticks; i += 1) {
      runtime.tick(16);
    }
    runtime.stop();
    runtime.dispose();
  } catch (err) {
    ok = false;
    error = err instanceof Error ? err.message : "Unknown runtime error";
  }

  const stateSnapshot = runtime.context.state.snapshot();

  return {
    ok,
    ticks,
    error,
    stateSnapshot,
    logs,
    startedAt,
    finishedAt: Date.now(),
  };
}

async function main() {
  const report = await runSmokeTest(5);
  const buildId = randomUUID();
  const repoRoot = findRepoRoot(process.cwd());
  const reportsDir = join(repoRoot, "workspaces", buildId, "reports");
  await mkdir(reportsDir, { recursive: true });
  const outputPath = join(reportsDir, "runtime-smoke.json");
  await writeFile(outputPath, JSON.stringify({ buildId, ...report }, null, 2), "utf-8");
  process.stdout.write(`runtime-smoke.json -> ${outputPath}\n`);
}

const isMain = pathToFileURL(process.argv[1] || "").href === import.meta.url;
if (isMain) {
  main().catch((err) => {
    process.stderr.write(
      err instanceof Error ? err.message : "Smoke runner failed\n"
    );
    process.exit(1);
  });
}
