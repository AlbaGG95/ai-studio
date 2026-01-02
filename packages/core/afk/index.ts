export type {
  Hero,
  PlayerState,
  Stage,
  Reward,
  Upgrade,
  CombatSummary,
  CombatEvent,
  IdleTickResult,
  TickContext,
  HeroVisual,
  BattleUnit,
} from "./types.js";
export { bootstrapPlayer, runIdleTicks, applyOfflineProgress } from "./idleEngine.js";
export { simulateCombat } from "./combatEngine.js";
export {
  combineRewards,
  grantReward,
  tickIncome,
  canAfford,
  payCost,
  upgradeCost,
  applyUpgrade,
} from "./economyEngine.js";
export {
  applyStageReward,
  unlockNextStage,
  setStage,
  applyVictory,
} from "./progressionEngine.js";
export {
  createInitialState,
  clonePlayerState,
  emptyReward,
  DEFAULT_REWARD,
  computeIdleRate,
  BASE_STAGES,
} from "./state.js";
export { generateRoster, buildHeroVisual, rarityScale } from "./heroFactory.js";
export { buildStages, findStage, nextStageId } from "./stages.js";
export { levelUpHero, levelUpCost } from "./heroProgression.js";
