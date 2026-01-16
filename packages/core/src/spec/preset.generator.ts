import { createHash } from "crypto";
import { DeterministicRng } from "../../runtime/rng.js";
import type {
  GameMeta,
  GameSpec,
  InventoryConfig,
  UIScreen,
  ScreenId,
} from "./gamespec.types.js";
import type { Preset, PresetTuning } from "./preset.types.js";

export interface PresetGenerationResult {
  normalizedPreset: Preset;
  presetHash: string;
  seedString: string;
  seedNumber: number;
  spec: GameSpec;
  tuning: PresetTuning;
}

function stableNormalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stableNormalize);
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return Object.keys(record)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = stableNormalize(record[key]);
        return acc;
      }, {});
  }
  return value;
}

function hashString(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function normalizePreset(preset: Preset): Preset {
  return stableNormalize(preset) as Preset;
}

export function hashPreset(preset: Preset): string {
  const normalized = normalizePreset(preset);
  return hashString(JSON.stringify(normalized));
}

export function derivePresetSeed(
  preset: Preset,
  presetHash: string
): { seedString: string; seedNumber: number } {
  const seedString = preset.seed ?? presetHash;
  const seedHash = hashString(seedString);
  const seedNumber = parseInt(seedHash.slice(0, 8), 16);
  return { seedString, seedNumber };
}

function mapPacing(pacing: PresetTuning["pacing"]) {
  switch (pacing) {
    case "slow":
      return { tickMs: 1500, baseIncome: 0.8 };
    case "fast":
      return { tickMs: 500, baseIncome: 1.4 };
    case "normal":
    default:
      return { tickMs: 1000, baseIncome: 1.0 };
  }
}

function mapEconomy(economy: PresetTuning["economy"]): number {
  switch (economy) {
    case "stingy":
      return 2;
    case "generous":
      return 12;
    case "normal":
    default:
      return 5;
  }
}

function mapDifficulty(difficulty: PresetTuning["difficulty"]): number {
  switch (difficulty) {
    case "easy":
      return 1.0;
    case "hard":
      return 1.6;
    case "normal":
    default:
      return 1.2;
  }
}

function buildScreens(inventoryEnabled: boolean): UIScreen[] {
  const screens: UIScreen[] = [
    { id: "home", name: "Home", enabled: true },
    { id: "battle", name: "Battle", enabled: true },
    { id: "heroes", name: "Heroes", enabled: true },
  ];
  if (inventoryEnabled) {
    screens.push({
      id: "inventory" as ScreenId,
      name: "Inventory",
      enabled: true,
    });
  }
  return screens;
}

export function generateGameSpecFromPreset(preset: Preset): GameSpec {
  return generateGameSpecFromPresetWithMeta(preset).spec;
}

export function generateGameSpecFromPresetWithMeta(
  preset: Preset
): PresetGenerationResult {
  const normalizedPreset = normalizePreset(preset);
  const presetHash = hashPreset(normalizedPreset);
  const { seedString, seedNumber } = derivePresetSeed(
    normalizedPreset,
    presetHash
  );

  const pacing = mapPacing(normalizedPreset.tuning.pacing);
  const goldPerSecond = mapEconomy(normalizedPreset.tuning.economy);
  const enemyHPScaling = mapDifficulty(normalizedPreset.tuning.difficulty);

  const rng = new DeterministicRng(seedNumber);
  const heroHp = 110 + rng.int(0, 20);
  const heroAtk = 10 + rng.int(0, 6);
  const heroDef = 3 + rng.int(0, 4);
  const enemyHp = 40 + rng.int(0, 12);
  const enemyAtk = 4 + rng.int(0, 4);
  const enemyGold = 2 + rng.int(0, 3);

  const meta: GameMeta = {
    name: normalizedPreset.meta.name,
    version: normalizedPreset.meta.version,
    language: normalizedPreset.meta.language,
    seed: seedNumber,
  };

  const inventory: InventoryConfig = {
    enabled: normalizedPreset.tuning.inventoryEnabled,
  };
  if (inventory.enabled) {
    inventory.maxSlots = 20;
  }

  const spec: GameSpec = {
    meta,
    engine: {
      templateId: normalizedPreset.meta.templateId,
    },
    systems: {
      idleLoop: {
        tickMs: pacing.tickMs,
        baseIncome: pacing.baseIncome,
      },
      combat: {
        auto: true,
        damageFormula: normalizedPreset.tuning.damageFormula,
      },
      progression: {
        levels: normalizedPreset.tuning.levels,
        scaling: normalizedPreset.tuning.progressionScaling,
      },
      inventory,
    },
    content: {
      heroes: [
        {
          id: "hero-1",
          name: "Hero",
          hp: heroHp,
          atk: heroAtk,
          def: heroDef,
        },
      ],
      enemies: [
        {
          id: "enemy-1",
          name: "Slime",
          hp: enemyHp,
          atk: enemyAtk,
          goldReward: enemyGold,
        },
      ],
      stages: [
        {
          id: "stage-1",
          name: "Stage 1",
          level: 1,
          enemies: ["enemy-1"],
        },
      ],
      items: [],
    },
    ui: {
      screens: buildScreens(normalizedPreset.tuning.inventoryEnabled),
    },
    balance: {
      goldPerSecond,
      enemyHPScaling,
    },
  };

  return {
    normalizedPreset,
    presetHash,
    seedString,
    seedNumber,
    spec,
    tuning: normalizedPreset.tuning,
  };
}
