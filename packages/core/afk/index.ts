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
  VisualDNA,
  HeroSkill,
  VisualFxStyle,
  VisualSilhouette,
} from "./types.js";
export { bootstrapPlayer, runIdleTicks, applyOfflineProgress } from "./idleEngine.js";
export { simulateCombat } from "./combatEngine.js";
export { simulateCombatTimeline, buildInitialUnits } from "./engineAdapter.js";
export type { CombatFrame, CombatTimeline } from "./engineAdapter.js";
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
export { generateHero, generateTeam } from "./content/heroGenerator.js";
export type { GeneratedHero } from "./content/heroGenerator.js";
export { makeRng, mulberry32, hashString } from "./seed.js";
export { buildStages, findStage, nextStageId } from "./stages.js";
export { levelUpHero, levelUpCost } from "./heroProgression.js";
