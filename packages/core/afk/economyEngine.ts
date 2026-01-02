import { clonePlayerState, DEFAULT_REWARD, upgradeIdleRate, BASE_STAGES } from "./state.js";
import { PlayerState, Reward, Stage, Upgrade } from "./types.js";

export function combineRewards(a: Reward | undefined, b: Reward | undefined): Reward {
  const left = a ?? DEFAULT_REWARD;
  const right = b ?? DEFAULT_REWARD;
  return {
    gold: left.gold + right.gold,
    exp: left.exp + right.exp,
    materials: left.materials + right.materials,
  };
}

export function grantReward(state: PlayerState, reward: Reward, mode: "direct" | "bank" = "bank"): PlayerState {
  const next = clonePlayerState(state);
  const target = mode === "bank" ? next.idle.bank : next.resources;
  target.gold += reward.gold;
  target.exp += reward.exp;
  target.materials += reward.materials;
  return next;
}

export function tickIncome(state: PlayerState, tickMs: number): Reward {
  const perMinute = state.idle.ratePerMinute;
  const factor = tickMs / 60000;
  return {
    gold: perMinute.gold * factor,
    exp: perMinute.exp * factor,
    materials: perMinute.materials * factor,
  };
}

export function canAfford(state: PlayerState, cost: Reward | undefined): boolean {
  if (!cost) return true;
  return (
    state.resources.gold >= cost.gold &&
    state.resources.exp >= cost.exp &&
    state.resources.materials >= cost.materials
  );
}

export function payCost(state: PlayerState, cost: Reward | undefined): PlayerState {
  if (!cost) return state;
  const next = clonePlayerState(state);
  next.resources.gold = Math.max(0, next.resources.gold - cost.gold);
  next.resources.exp = Math.max(0, next.resources.exp - cost.exp);
  next.resources.materials = Math.max(0, next.resources.materials - cost.materials);
  return next;
}

export function upgradeCost(upgrade: Upgrade): Reward {
  const multiplier = upgrade.level + 1;
  return {
    gold: Math.round(upgrade.cost.gold * multiplier),
    exp: Math.round(upgrade.cost.exp * multiplier),
    materials: Math.round(upgrade.cost.materials * (1 + upgrade.level * 0.35)),
  };
}

export function applyUpgrade(state: PlayerState, id: string, stage?: Stage): PlayerState {
  const target = state.upgrades.find((u) => u.id === id);
  if (!target) return state;
  const cost = upgradeCost(target);
  if (!canAfford(state, cost)) return state;
  if (target.cap && target.level >= target.cap) return state;

  const next = payCost(state, cost);
  const toBump = next.upgrades.find((u) => u.id === id);
  if (!toBump) return state;
  toBump.level += 1;
  toBump.unlocked = true;
  const currentStage =
    stage ??
    BASE_STAGES.find((s) => s.id === state.campaign.currentStageId) ??
    BASE_STAGES[0];
  return upgradeIdleRate(next, currentStage);
}
