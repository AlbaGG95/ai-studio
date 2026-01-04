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
  canAfford as canAffordAfkUpgrade,
  payCost as payAfkCost,
  upgradeCost as computeAfkUpgradeCost,
  applyUpgrade as applyAfkUpgrade,
} from "./afk/economyEngine.js";
export {
  applyStageReward as applyAfkStageReward,
  unlockNextStage as unlockAfkStage,
  setStage as setAfkStage,
  applyVictory as applyAfkVictory,
} from "./afk/progressionEngine.js";
export {
  createInitialState as createInitialAfkState,
  clonePlayerState as cloneAfkPlayerState,
  computeIdleRate as computeAfkIdleRate,
  BASE_STAGES as AFK_STAGES,
  DEFAULT_REWARD as AFK_EMPTY_REWARD,
} from "./afk/state.js";
export { buildHeroVisual as buildAfkHeroVisual, generateRoster as generateAfkRoster, rarityScale as afkRarityScale } from "./afk/heroFactory.js";
export { levelUpHero as levelUpAfkHero, levelUpCost as afkLevelUpCost } from "./afk/heroProgression.js";
export { buildStages as buildAfkStages, findStage as findAfkStage, nextStageId as nextAfkStageId } from "./afk/stages.js";
export { generateHero, generateTeam } from "./afk/content/heroGenerator.js";
export { simulateCombatTimeline, buildInitialUnits } from "./afk/engineAdapter.js";
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
  CombatEvent as AfkCombatEvent,
  IdleTickResult as AfkIdleTickResult,
  TickContext as AfkTickContext,
  HeroVisual as AfkHeroVisual,
  BattleUnit as AfkBattleUnit,
} from "./afk/types.js";
export type { Stage, VisualDNA, HeroSkill, VisualFxStyle, VisualSilhouette } from "./afk/types.js";
export type { GeneratedHero } from "./afk/content/heroGenerator.js";
export type { CombatFrame, CombatTimeline } from "./afk/engineAdapter.js";
