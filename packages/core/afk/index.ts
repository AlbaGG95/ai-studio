export type {
  Hero,
  PlayerState,
  Stage,
  Reward,
  Upgrade,
  CombatSummary,
  IdleTickResult,
  TickContext,
} from "./types.js";
export { bootstrapPlayer, runIdleTicks, applyOfflineProgress } from "./idleEngine.js";
export { simulateCombat } from "./combatEngine.js";
export {
  combineRewards,
  grantReward,
  tickIncome,
  getUpgradeMultiplier,
  canAfford,
  payCost,
  upgradeCost,
  applyUpgrade,
} from "./economyEngine.js";
export {
  applyStageProgress,
  advanceStage,
  applyStageReward,
  handleMilestoneUnlocks,
} from "./progressionEngine.js";
export { createInitialState, clonePlayerState, emptyReward } from "./state.js";
