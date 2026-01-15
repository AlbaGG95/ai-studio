/**
 * GameSpec v1 TypeScript Types
 * Aligned with packages/core/spec/gamespec.schema.json
 */

export type GameLanguage = "en" | "es";
export type TemplateId = "idle-rpg-base";
export type DamageFormula = "linear" | "scaling" | "exponential";
export type ProgressionScaling = "linear" | "quadratic" | "exponential";
export type ScreenId = "home" | "battle" | "inventory" | "heroes";
export type ItemRarity = "common" | "rare" | "epic" | "legendary";

export interface GameMeta {
  name: string;
  version: string; // semver
  language: GameLanguage;
  description?: string;
  seed?: number;
}

export interface GameEngine {
  templateId: TemplateId;
}

export interface IdleLoopConfig {
  tickMs: number; // 100-10000
  baseIncome: number; // 0.1-1000
}

export interface CombatConfig {
  auto: boolean;
  damageFormula: DamageFormula;
}

export interface ProgressionConfig {
  levels: number; // 10-200
  scaling: ProgressionScaling;
}

export interface InventoryConfig {
  enabled: boolean;
  maxSlots?: number; // 5-200, default 20
}

export interface GameSystems {
  idleLoop: IdleLoopConfig;
  combat: CombatConfig;
  progression: ProgressionConfig;
  inventory: InventoryConfig;
}

export interface Hero {
  id: string;
  name: string;
  description?: string;
  hp: number; // min 1
  atk: number; // min 1
  def: number; // min 0
}

export interface Enemy {
  id: string;
  name: string;
  hp: number; // min 1
  atk: number; // min 1
  goldReward: number; // min 1
}

export interface Stage {
  id: string;
  name: string;
  level: number; // min 1
  enemies: string[]; // enemy IDs
}

export interface ItemStats {
  atk?: number; // min 0
  def?: number; // min 0
  hp?: number; // min 0
}

export interface Item {
  id: string;
  name: string;
  rarity: ItemRarity;
  stats?: ItemStats;
}

export interface GameContent {
  heroes: Hero[];
  enemies: Enemy[];
  stages: Stage[];
  items: Item[];
}

export interface UIScreen {
  id: ScreenId;
  name: string;
  enabled?: boolean; // default true
}

export interface GameUI {
  screens: UIScreen[];
}

export interface GameBalance {
  goldPerSecond: number; // 0.1-10000
  enemyHPScaling: number; // 1-5
}

/**
 * Main GameSpec contract
 */
export interface GameSpec {
  meta: GameMeta;
  engine: GameEngine;
  systems: GameSystems;
  content: GameContent;
  ui: GameUI;
  balance: GameBalance;
}

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors?: string[];
  data?: GameSpec;
}
