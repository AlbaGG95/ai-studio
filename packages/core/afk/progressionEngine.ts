import { combineRewards, grantReward } from "./economyEngine.js";
import { PlayerState, Reward, Stage } from "./types.js";

export interface StageProgressResult {
  stage: Stage;
  cleared: boolean;
}

export function applyStageProgress(stage: Stage, delta: number): StageProgressResult {
  const progress = Math.min(1, stage.progress + delta);
  const cleared = progress >= 1;
  return {
    stage: { ...stage, progress },
    cleared,
  };
}

export function advanceStage(current: Stage): Stage {
  const nextIndex = current.index + 1;
  const reward: Reward = {
    gold: Math.round(current.reward.gold * 1.1 + nextIndex),
    essence: Math.round(current.reward.essence * 1.05 + 1),
  };
  return {
    id: `stage-${nextIndex}`,
    index: nextIndex,
    enemyPower: Math.round(current.enemyPower * 1.12 + 5),
    reward,
    progress: 0,
    milestone: nextIndex % 5 === 0,
  };
}

export function applyStageReward(state: PlayerState, reward: Reward): PlayerState {
  const combined = combineRewards(reward, { gold: 0, essence: 0 });
  return grantReward(state, combined, "bank");
}

export function handleMilestoneUnlocks(state: PlayerState): PlayerState {
  const next = { ...state, unlocks: { ...state.unlocks } };
  if (state.stage.milestone) {
    next.unlocks.upgrades = true;
    if (state.stage.index >= 3) {
      next.unlocks.heroes = true;
    }
    if (state.stage.index >= 5) {
      next.unlocks.settings = true;
    }
  }
  return next;
}
