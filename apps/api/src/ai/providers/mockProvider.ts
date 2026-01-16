import { createHash } from "crypto";
import type { PresetProvider, PresetProviderResult } from "./types.js";

const PACING = ["slow", "normal", "fast"] as const;
const DIFFICULTY = ["easy", "normal", "hard"] as const;
const ECONOMY = ["stingy", "normal", "generous"] as const;
const DAMAGE = ["linear", "scaling", "exponential"] as const;
const PROGRESSION = ["linear", "quadratic", "exponential"] as const;

function pick<T>(values: readonly T[], seed: Buffer, index: number): T {
  return values[seed[index % seed.length] % values.length];
}

function clampLevels(seed: Buffer): number {
  const value = 10 + (seed[10] % 191);
  return Math.min(200, Math.max(10, value));
}

export const mockProvider: PresetProvider = {
  name: "mock",
  model: "mock",
  async generatePreset(prompt: string): Promise<PresetProviderResult> {
    const hash = createHash("sha256").update(prompt).digest();
    const id = createHash("sha256").update(prompt).digest("hex").slice(0, 8);
    const preset = {
      meta: {
        name: `AI Preset ${id}`,
        version: "0.1.0",
        language: "es",
        templateId: "idle-rpg-base@1.2",
      },
      tuning: {
        pacing: pick(PACING, hash, 0),
        difficulty: pick(DIFFICULTY, hash, 1),
        economy: pick(ECONOMY, hash, 2),
        inventoryEnabled: (hash[3] % 2) === 0,
        damageFormula: pick(DAMAGE, hash, 4),
        progressionScaling: pick(PROGRESSION, hash, 5),
        levels: clampLevels(hash),
      },
      seed: `mock-${id}`,
    };

    const raw = JSON.stringify(preset, null, 2);
    return {
      preset,
      raw,
      provider: "mock",
      model: "mock",
    };
  },
};
