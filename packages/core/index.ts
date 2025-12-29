export interface Project {
  id: string;
  name: string;
  createdAt: string;
}

export interface FileToWrite {
  path: string;
  content: string;
}

export interface ApplyRequest {
  files: FileToWrite[];
}

export * from "./spec/index.js";
export type {
  EngineConfig,
  EngineState,
  PlayerState as EnginePlayerState,
  CombatState as EngineCombatState,
  UnitRuntimeState,
  GachaConfig,
  AfkState,
  CampaignState,
  TimelineState,
  UnitTemplate as EngineUnitTemplate,
  EnemyTemplate as EngineEnemyTemplate,
  StageDefinition as EngineStageDefinition,
  Item as EngineItem,
  Ability as EngineAbility,
  Stats as EngineStats,
  Role as EngineRole,
  Faction as EngineFaction,
  Rarity as EngineRarity,
} from "./engine/types.js";
export { IdleRpgEngine, DEFAULT_ENGINE_CONFIG } from "./engine/engine.js";
