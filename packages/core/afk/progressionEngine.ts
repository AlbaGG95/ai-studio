import { combineRewards, grantReward } from "./economyEngine.js";
import { BASE_STAGES, upgradeIdleRate } from "./state.js";
import { PlayerState, Reward, Stage } from "./types.js";

export function applyStageReward(state: PlayerState, reward: Reward): PlayerState {
  const combined = combineRewards(reward, undefined);
  return grantReward(state, combined, "direct");
}

export function unlockNextStage(state: PlayerState, stage: Stage): PlayerState {
  const stages = BASE_STAGES;
  const idx = stages.findIndex((s) => s.id === stage.id);
  if (idx === -1) return state;
  const nextStage = stages[idx + 1];
  const next = { ...state, campaign: { ...state.campaign } };
  if (nextStage) {
    if (!next.campaign.unlockedStageIds.includes(nextStage.id)) {
      next.campaign.unlockedStageIds = [...next.campaign.unlockedStageIds, nextStage.id];
    }
    next.campaign.currentStageId = nextStage.id;
  }
  if (!next.campaign.completedStageIds.includes(stage.id)) {
    next.campaign.completedStageIds = [...next.campaign.completedStageIds, stage.id];
  }
  return next;
}

export function setStage(state: PlayerState, stageId: string): PlayerState {
  const next = { ...state, campaign: { ...state.campaign } };
  next.campaign.currentStageId = stageId;
  return next;
}

export function applyVictory(state: PlayerState, stage: Stage): PlayerState {
  let next = applyStageReward(state, stage.reward);
  next = unlockNextStage(next, stage);
  const updatedStage = BASE_STAGES.find((s) => s.id === next.campaign.currentStageId) ?? stage;
  next = upgradeIdleRate(next, updatedStage);
  return next;
}
