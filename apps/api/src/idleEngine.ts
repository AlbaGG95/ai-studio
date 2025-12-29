import { IdleRpgEngine, EngineState } from "@ai-studio/core";
import { existsSync } from "fs";
import { mkdir, readFile, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";

import { REPO_ROOT } from "./paths.js";

const ENGINE_DIR = join(REPO_ROOT, "data", "idle-engine");
const ENGINE_STATE_FILE = join(ENGINE_DIR, "state.json");
const ENGINE_STATE_FALLBACK = join(tmpdir(), "ai-studio-idle-engine-state.json");
const LOCK_ERROR_CODES = new Set(["EBUSY", "EPERM"]);

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const isLockError = (error: unknown): error is NodeJS.ErrnoException => {
  const code = (error as NodeJS.ErrnoException)?.code;
  return !!code && LOCK_ERROR_CODES.has(code);
};

async function readState(path: string): Promise<EngineState | null> {
  if (!existsSync(path)) return null;
  try {
    const content = await readFile(path, "utf-8");
    return JSON.parse(content) as EngineState;
  } catch (err) {
    if (isLockError(err)) {
      console.warn(`Idle engine state locked while reading (${path}). Retrying...`);
      await delay(150);
      try {
        const content = await readFile(path, "utf-8");
        return JSON.parse(content) as EngineState;
      } catch {
        console.warn(`Idle engine state still locked at ${path}.`);
      }
    }
    return null;
  }
}

async function writeStateWithRetry(path: string, content: string, retries = 2) {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      await writeFile(path, content, "utf-8");
      return;
    } catch (err) {
      lastError = err;
      if (isLockError(err) && attempt < retries) {
        const waitMs = 150 * (attempt + 1);
        console.warn(`Idle engine state locked while writing (${path}). Retry in ${waitMs}ms...`);
        await delay(waitMs);
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}

async function loadStateFromDisk(): Promise<EngineState | null> {
  const state = await readState(ENGINE_STATE_FILE);
  if (state) return state;
  const fallback = await readState(ENGINE_STATE_FALLBACK);
  if (fallback) {
    console.warn(`Using fallback idle engine state from ${ENGINE_STATE_FALLBACK}`);
    return fallback;
  }
  return null;
}

export async function persistEngine(engine: IdleRpgEngine) {
  await mkdir(ENGINE_DIR, { recursive: true });
  const state = engine.getState();
  const payload = JSON.stringify(state, null, 2);

  try {
    await writeStateWithRetry(ENGINE_STATE_FILE, payload);
  } catch (err) {
    if (isLockError(err)) {
      console.warn(
        `Idle engine state locked at ${ENGINE_STATE_FILE}. Writing to fallback: ${ENGINE_STATE_FALLBACK}`
      );
      await writeStateWithRetry(ENGINE_STATE_FALLBACK, payload);
    } else {
      throw err;
    }
  }
  return state;
}

export async function loadEngine(now = Date.now()) {
  const existing = await loadStateFromDisk();
  const engine = existing ? IdleRpgEngine.fromState(existing) : IdleRpgEngine.create(undefined, now);
  engine.syncOffline(now);
  await persistEngine(engine);
  return engine;
}

export async function generateEngine(seed?: number | string, now = Date.now()) {
  const engine = IdleRpgEngine.create(seed, now);
  await persistEngine(engine);
  return engine;
}

export async function saveEngineState(state: EngineState) {
  const engine = IdleRpgEngine.fromState(state);
  await persistEngine(engine);
  return engine;
}

export const enginePaths = {
  dir: ENGINE_DIR,
  stateFile: ENGINE_STATE_FILE,
  fallbackStateFile: ENGINE_STATE_FALLBACK,
};
