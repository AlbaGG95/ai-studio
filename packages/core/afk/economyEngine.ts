import { clonePlayerState, emptyReward } from "./state.js";
import { PlayerState, Reward, Upgrade, UpgradeEffect } from "./types.js";

export function combineRewards(a: Reward | undefined, b: Reward | undefined): Reward {
  if (!a && !b) return emptyReward();
  const left = a ?? emptyReward();
  const right = b ?? emptyReward();
  return {
    gold: left.gold + right.gold,
    essence: left.essence + right.essence,
    items: [...(left.items ?? []), ...(right.items ?? [])],
    shards: (left.shards ?? 0) + (right.shards ?? 0),
    multiplier: undefined,
  };
}

export function grantReward(state: PlayerState, reward: Reward, mode: "direct" | "bank" = "bank"): PlayerState {
  const next = clonePlayerState(state);
  const target = mode === "bank" ? next.afkBank : next.resources;

  target.gold += reward.gold;
  target.essence += reward.essence;
  if (mode === "bank") {
    if (reward.items?.length) {
      next.afkBank.items = [...(next.afkBank.items ?? []), ...reward.items];
    }
    if (reward.shards) {
      next.afkBank.shards = (next.afkBank.shards ?? 0) + reward.shards;
    }
  }
  return next;
}

export function tickIncome(state: PlayerState, basePerTick: Reward, multiplier = 1): Reward {
  const reward = combineRewards(basePerTick, undefined);
  const rateBoost = getUpgradeMultiplier(state.upgrades, "resourceRate", 1);
  const factor = (reward.multiplier ?? 1) * rateBoost * multiplier;
  return {
    gold: reward.gold * factor,
    essence: reward.essence * factor,
    items: reward.items,
    shards: reward.shards,
  };
}

export function getUpgradeMultiplier(upgrades: Upgrade[], key: keyof UpgradeEffect, fallback = 1): number {
  return upgrades.reduce((acc, upgrade) => {
    if (!upgrade.unlocked) return acc;
    const effect = upgrade.effect[key];
    if (!effect) return acc;
    return acc + effect;
  }, fallback);
}

export function canAfford(state: PlayerState, cost: Reward | undefined): boolean {
  if (!cost) return true;
  return state.resources.gold >= cost.gold && state.resources.essence >= cost.essence;
}

export function payCost(state: PlayerState, cost: Reward | undefined): PlayerState {
  if (!cost) return state;
  const next = clonePlayerState(state);
  next.resources.gold = Math.max(0, next.resources.gold - cost.gold);
  next.resources.essence = Math.max(0, next.resources.essence - cost.essence);
  return next;
}

export function upgradeCost(upgrade: Upgrade): Reward {
  const multiplier = upgrade.level + 1;
  return {
    gold: upgrade.cost.gold * multiplier,
    essence: (upgrade.cost.essence ?? 0) * multiplier,
  };
}

export function applyUpgrade(state: PlayerState, id: string): PlayerState {
  const next = clonePlayerState(state);
  const target = next.upgrades.find((u) => u.id === id);
  if (!target) return state;
  const cost = upgradeCost(target);
  if (!canAfford(next, cost)) return state;
  if (target.cap && target.level >= target.cap) return state;

  const updated = payCost(next, cost);
  target.level += 1;
  target.unlocked = true;
  return updated;
}
