import { createHash } from "crypto";
import type {
  DamageFormula,
  GameMeta,
  GameLanguage,
  GameSpec,
  InventoryConfig,
  ProgressionScaling,
  ScreenId,
  UIScreen,
  TemplateId,
} from "@ai-studio/core";
import type { GameSpecIntent } from "./types.js";

export interface GameSpecGenerationResult {
  buildId: string;
  intentHash: string;
  normalizedIntent: unknown;
  spec: GameSpec;
  defaultsApplied: string[];
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

function deriveSeedFromHash(hash: string): number {
  return parseInt(hash.slice(0, 8), 16);
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function readBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function readNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function readInteger(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) ? value : undefined;
}

function readEnum<T extends string>(
  value: unknown,
  allowed: readonly T[]
): T | undefined {
  return typeof value === "string" && allowed.includes(value as T)
    ? (value as T)
    : undefined;
}

export function generateGameSpec(
  input: unknown
): GameSpecGenerationResult {
  const intent =
    input && typeof input === "object" ? (input as GameSpecIntent) : {};
  const normalizedIntent = stableNormalize(intent);
  const intentHash = hashString(JSON.stringify(normalizedIntent));
  const buildId = `game-${intentHash.slice(0, 12)}`;
  const defaultsApplied: string[] = [];

  const name = readString(intent.name) ?? "AI Studio Game";
  if (intent.name === undefined) defaultsApplied.push("meta.name");

  const version = readString(intent.version) ?? "0.1.0";
  if (intent.version === undefined) defaultsApplied.push("meta.version");

  const language =
    readEnum<GameLanguage>(intent.language, ["en", "es"]) ?? "es";
  if (intent.language === undefined) defaultsApplied.push("meta.language");

  const description = readString(intent.description);

  const templateId =
    readEnum<TemplateId>(intent.templateId, ["idle-rpg-base"]) ??
    "idle-rpg-base";
  if (intent.templateId === undefined) defaultsApplied.push("engine.templateId");

  const seed = readInteger(intent.seed) ?? deriveSeedFromHash(intentHash);
  if (intent.seed === undefined) defaultsApplied.push("meta.seed");

  const tickMs = readInteger(intent.tickMs) ?? 1000;
  if (intent.tickMs === undefined) defaultsApplied.push("systems.idleLoop.tickMs");

  const baseIncome = readNumber(intent.baseIncome) ?? 1;
  if (intent.baseIncome === undefined)
    defaultsApplied.push("systems.idleLoop.baseIncome");

  const combatAuto = readBoolean(intent.combatAuto) ?? true;
  if (intent.combatAuto === undefined)
    defaultsApplied.push("systems.combat.auto");

  const damageFormula =
    readEnum<DamageFormula>(intent.damageFormula, [
      "linear",
      "scaling",
      "exponential",
    ]) ?? "linear";
  if (intent.damageFormula === undefined)
    defaultsApplied.push("systems.combat.damageFormula");

  const levels = readInteger(intent.levels) ?? 20;
  if (intent.levels === undefined)
    defaultsApplied.push("systems.progression.levels");

  const progressionScaling =
    readEnum<ProgressionScaling>(intent.progressionScaling, [
      "linear",
      "quadratic",
      "exponential",
    ]) ?? "linear";
  if (intent.progressionScaling === undefined)
    defaultsApplied.push("systems.progression.scaling");

  const inventoryEnabled = readBoolean(intent.inventoryEnabled) ?? false;
  if (intent.inventoryEnabled === undefined)
    defaultsApplied.push("systems.inventory.enabled");

  let inventoryMaxSlots = readInteger(intent.inventoryMaxSlots);
  if (inventoryMaxSlots === undefined && inventoryEnabled === true) {
    inventoryMaxSlots = 20;
    defaultsApplied.push("systems.inventory.maxSlots");
  }

  const goldPerSecond = readNumber(intent.goldPerSecond) ?? 5;
  if (intent.goldPerSecond === undefined)
    defaultsApplied.push("balance.goldPerSecond");

  const enemyHPScaling = readNumber(intent.enemyHPScaling) ?? 1.1;
  if (intent.enemyHPScaling === undefined)
    defaultsApplied.push("balance.enemyHPScaling");

  const screens: UIScreen[] = [
    { id: "home", name: "Home", enabled: true },
    { id: "battle", name: "Battle", enabled: true },
    { id: "heroes", name: "Heroes", enabled: true },
  ];
  if (inventoryEnabled === true) {
    screens.push({
      id: "inventory" as ScreenId,
      name: "Inventory",
      enabled: true,
    });
  }

  const meta: GameMeta = {
    name,
    version,
    language,
    seed,
  };
  if (description !== undefined) {
    meta.description = description;
  }

  const inventory: InventoryConfig = {
    enabled: inventoryEnabled,
  };
  if (inventoryMaxSlots !== undefined) {
    inventory.maxSlots = inventoryMaxSlots;
  }

  const spec: GameSpec = {
    meta,
    engine: {
      templateId,
    },
    systems: {
      idleLoop: {
        tickMs,
        baseIncome,
      },
      combat: {
        auto: combatAuto,
        damageFormula,
      },
      progression: {
        levels,
        scaling: progressionScaling,
      },
      inventory,
    },
    content: {
      heroes: [
        {
          id: "hero-1",
          name: "Hero",
          hp: 120,
          atk: 12,
          def: 4,
        },
      ],
      enemies: [
        {
          id: "enemy-1",
          name: "Slime",
          hp: 40,
          atk: 4,
          goldReward: 2,
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
      screens,
    },
    balance: {
      goldPerSecond,
      enemyHPScaling,
    },
  };

  return {
    buildId,
    intentHash,
    normalizedIntent,
    spec,
    defaultsApplied,
  };
}
