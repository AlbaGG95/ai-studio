import { IdleRpgEngine, EngineState } from "@ai-studio/core";
import { existsSync } from "fs";
import { mkdir, readFile, writeFile } from "fs/promises";
import { join } from "path";

import { REPO_ROOT } from "./paths.js";

const ENGINE_DIR = join(REPO_ROOT, "data", "idle-engine");
const ENGINE_STATE_FILE = join(ENGINE_DIR, "state.json");

async function loadStateFromDisk(): Promise<EngineState | null> {
  if (!existsSync(ENGINE_STATE_FILE)) return null;
  try {
    const content = await readFile(ENGINE_STATE_FILE, "utf-8");
    return JSON.parse(content) as EngineState;
  } catch {
    return null;
  }
}

export async function persistEngine(engine: IdleRpgEngine) {
  await mkdir(ENGINE_DIR, { recursive: true });
  const state = engine.getState();
  await writeFile(ENGINE_STATE_FILE, JSON.stringify(state, null, 2), "utf-8");
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
};
