import path from "path";
import { mkdir, readFile, writeFile } from "fs/promises";
import { pathToFileURL } from "url";
import { Runtime } from "./runtime.js";
import type { Logger, RuntimeContext, RuntimeModule } from "./types.js";
import type { FeatureManifest } from "../src/spec/feature-manifest.types.js";

export interface AssemblySmokeInput<Spec> {
  spec: Spec;
  manifests: FeatureManifest[];
  assemblyDir: string;
  ticks?: number;
}

export interface AssemblySmokeResult {
  ok: boolean;
  error: string | null;
  ticks: number;
  logs: string[];
  stateSnapshot: Record<string, unknown>;
  loadedModules: string[];
  startedAt: number;
  finishedAt: number;
}

function createLogger(buffer: string[]): Logger {
  return {
    info: (message) => buffer.push(`info: ${message}`),
    warn: (message) => buffer.push(`warn: ${message}`),
    error: (message) => buffer.push(`error: ${message}`),
    debug: (message) => buffer.push(`debug: ${message}`),
  };
}

function normalizePath(value: string) {
  return value.replace(/\\/g, "/").replace(/^\.\/+/, "");
}

function resolvePathWithinRoot(
  rootDir: string,
  relativePath: string,
  label: string
) {
  const normalized = normalizePath(relativePath);
  const target = path.resolve(rootDir, normalized);
  if (!target.startsWith(`${rootDir}${path.sep}`) && target !== rootDir) {
    throw new Error(`${label} fuera de ${rootDir}: ${relativePath}`);
  }
  return target;
}

async function buildRuntimeCache(
  assemblyDir: string,
  manifest: FeatureManifest
) {
  const entryFile = manifest.files.find(
    (file) => file.path === manifest.module.entry
  );
  if (!entryFile) {
    throw new Error(`Entry no declarado en manifest: ${manifest.module.id}`);
  }

  const cacheKey = entryFile.sha256 || "0";
  const cacheRoot = path.join(
    assemblyDir,
    ".runtime-cache",
    manifest.module.id,
    cacheKey
  );

  const files = [...manifest.files].sort((a, b) =>
    normalizePath(a.path).localeCompare(normalizePath(b.path))
  );

  await mkdir(cacheRoot, { recursive: true });
  for (const file of files) {
    const source = resolvePathWithinRoot(assemblyDir, file.path, "archivo");
    const target = resolvePathWithinRoot(cacheRoot, file.path, "cache");
    await mkdir(path.dirname(target), { recursive: true });
    const content = await readFile(source);
    await writeFile(target, content);
  }

  const entryPath = resolvePathWithinRoot(
    cacheRoot,
    manifest.module.entry,
    "entry"
  );

  return {
    entryPath,
    cacheKey,
  };
}

function resolveRuntimeModule(
  exported: Record<string, unknown>,
  fallbackId: string
): RuntimeModule<any, Record<string, unknown>> {
  const candidate =
    (exported.default as RuntimeModule<any, Record<string, unknown>> | undefined) ||
    (exported.module as RuntimeModule<any, Record<string, unknown>> | undefined);

  if (candidate && typeof candidate === "object") {
    return {
      id: candidate.id || fallbackId,
      init: candidate.init,
      start: candidate.start,
      tick: candidate.tick,
      stop: candidate.stop,
      dispose: candidate.dispose,
    } as RuntimeModule<any, Record<string, unknown>>;
  }

  const createModule = exported.createModule as
    | ((ctx: RuntimeContext<any, Record<string, unknown>>) => RuntimeModule<any, Record<string, unknown>>)
    | undefined;

  if (createModule) {
    return createModule({} as RuntimeContext<any, Record<string, unknown>>);
  }

  throw new Error(`No se encontro RuntimeModule exportado para ${fallbackId}`);
}

function validateRuntimeModule(
  module: RuntimeModule<any, Record<string, unknown>>
) {
  if (
    !module ||
    typeof module.init !== "function" ||
    typeof module.start !== "function" ||
    typeof module.tick !== "function" ||
    typeof module.stop !== "function" ||
    typeof module.dispose !== "function"
  ) {
    throw new Error(`RuntimeModule invalido: ${module?.id || "unknown"}`);
  }
}

export async function runAssemblySmokeTest<Spec>(
  input: AssemblySmokeInput<Spec>
): Promise<AssemblySmokeResult> {
  const ticks = input.ticks ?? 5;
  const logs: string[] = [];
  const logger = createLogger(logs);
  const runtime = new Runtime<Spec, Record<string, unknown>>(
    input.spec,
    logger,
    42
  );

  const loadedModules: string[] = [];
  let ok = true;
  let error: string | null = null;

  try {
    for (const manifest of input.manifests) {
      const cache = await buildRuntimeCache(input.assemblyDir, manifest);
      const entryUrl = pathToFileURL(cache.entryPath).href;
      const exported = (await import(entryUrl)) as Record<string, unknown>;
      const module = resolveRuntimeModule(exported, manifest.module.id);
      module.id = module.id || manifest.module.id;
      validateRuntimeModule(module);
      runtime.register(module);
      loadedModules.push(module.id);
    }

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

  return {
    ok,
    error,
    ticks,
    logs,
    stateSnapshot: runtime.context.state.snapshot(),
    loadedModules,
    startedAt: 0,
    finishedAt: runtime.context.clock.now(),
  };
}
