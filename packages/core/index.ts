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
export {
  bootstrapPlayer as createAfkPlayer,
  runIdleTicks as runAfkTicks,
  applyOfflineProgress as applyAfkOfflineProgress,
} from "./afk/idleEngine.js";
export { simulateCombat as simulateAfkCombat } from "./afk/combatEngine.js";
export {
  combineRewards as combineAfkRewards,
  grantReward as grantAfkReward,
  tickIncome as computeAfkTickIncome,
  getUpgradeMultiplier as getAfkUpgradeMultiplier,
  canAfford as canAffordAfkUpgrade,
  payCost as payAfkCost,
  upgradeCost as computeAfkUpgradeCost,
  applyUpgrade as applyAfkUpgrade,
} from "./afk/economyEngine.js";
export {
  applyStageProgress as applyAfkStageProgress,
  advanceStage as advanceAfkStage,
  applyStageReward as applyAfkStageReward,
  handleMilestoneUnlocks as handleAfkMilestones,
} from "./afk/progressionEngine.js";
export { createInitialState as createInitialAfkState, clonePlayerState as cloneAfkPlayerState } from "./afk/state.js";
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
export type { TriviaQuestion, TriviaState } from "./trivia/types.js";
export { createTriviaState, answerQuestion } from "./trivia/engine.js";
export type { RunnerState, RunnerConfig, RunnerObstacle, RunnerPlayer } from "./runner/types.js";
export { createRunnerState, startRunner, stepRunner, restartRunner, DEFAULT_RUNNER_CONFIG } from "./runner/engine.js";
export type { TowerDefenseState, TowerConfig, Tower, Enemy as TdEnemy } from "./tower/types.js";
export { createTowerDefenseState, placeTower, startWave as startTowerWave, step as stepTower, DEFAULT_TD_CONFIG } from "./tower/engine.js";
export type {
  Hero as AfkHero,
  PlayerState as AfkPlayerState,
  Stage as AfkStage,
  Reward as AfkReward,
  Upgrade as AfkUpgrade,
  CombatSummary as AfkCombatSummary,
  IdleTickResult as AfkIdleTickResult,
  TickContext as AfkTickContext,
} from "./afk/types.js";
