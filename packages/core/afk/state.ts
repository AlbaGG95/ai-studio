import { generateRoster, rarityScale } from "./heroFactory.js";
import { buildStages } from "./stages.js";
import { PlayerState, Reward, Stage } from "./types.js";

export const DEFAULT_REWARD: Reward = { gold: 0, exp: 0, materials: 0 };
export const BASE_STAGES: Stage[] = buildStages();

export function clonePlayerState(state: PlayerState): PlayerState {
  return {
    resources: { ...state.resources },
    heroes: state.heroes.map((hero) => ({ ...hero, stats: { ...hero.stats } })),
    activeHeroIds: [...state.activeHeroIds],
    campaign: {
      chapter: state.campaign.chapter,
      currentStageId: state.campaign.currentStageId,
      unlockedStageIds: [...state.campaign.unlockedStageIds],
      completedStageIds: [...state.campaign.completedStageIds],
    },
    upgrades: state.upgrades.map((upgrade) => ({
      ...upgrade,
      cost: { ...upgrade.cost },
      effect: { ...upgrade.effect },
    })),
    idle: {
      bank: { ...state.idle.bank },
      lastSeenAt: state.idle.lastSeenAt,
      lastClaimAt: state.idle.lastClaimAt,
      ratePerMinute: { ...state.idle.ratePerMinute },
    },
  };
}

export function createInitialState(now: number, heroCount = 10): PlayerState {
  const heroes = generateRoster(heroCount, `afk-seed-${now}`);
  const stages = BASE_STAGES;
  const starterStage = stages[0];

  return {
    resources: { gold: 200, exp: 0, materials: 40 },
    heroes,
    activeHeroIds: heroes.slice(0, 5).map((h) => h.id),
    campaign: {
      chapter: 1,
      currentStageId: starterStage.id,
      unlockedStageIds: [starterStage.id],
      completedStageIds: [],
    },
    upgrades: [
      {
        id: "idle-rate",
        name: "Campfire Wisdom",
        level: 0,
        cost: { gold: 120, exp: 0, materials: 4 },
        effect: { idleBoost: 0.15 },
        unlocked: true,
      },
      {
        id: "battle-power",
        name: "Training Grounds",
        level: 0,
        cost: { gold: 140, exp: 8, materials: 6 },
        effect: { powerBoost: 0.08 },
        unlocked: true,
      },
    ],
    idle: {
      bank: { ...DEFAULT_REWARD },
      lastSeenAt: now,
      lastClaimAt: now,
      ratePerMinute: computeIdleRate(starterStage, 0, heroes),
    },
  };
}

export function emptyReward(): Reward {
  return { ...DEFAULT_REWARD };
}

export function computeIdleRate(stage: Stage, idleBoost: number, heroes: { power: number }[]): Reward {
  const heroPower = heroes.reduce((acc, h) => acc + h.power, 0);
  const powerFactor = 1 + heroPower / 1200;
  const baseGold = Math.round((5 + stage.index * 2) * (1 + idleBoost) * powerFactor);
  const baseExp = Math.round((2 + stage.index) * (1 + idleBoost * 0.8));
  const materials = Math.max(1, Math.round((1 + stage.index * 0.5) * (1 + idleBoost * 0.6)));
  return { gold: baseGold, exp: baseExp, materials };
}

export function heroPowerWithUpgrades(power: number, upgrades: number): number {
  return Math.round(power * (1 + upgrades * 0.08));
}

export function upgradeIdleRate(state: PlayerState, stage: Stage): PlayerState {
  const idleUpgrade = state.upgrades.find((u) => u.id === "idle-rate");
  const idleBoost = idleUpgrade ? idleUpgrade.level * (idleUpgrade.effect.idleBoost ?? 0) : 0;
  const next = clonePlayerState(state);
  next.idle.ratePerMinute = computeIdleRate(stage, idleBoost, state.heroes);
  return next;
}

export function upgradePowerBoost(state: PlayerState): number {
  const up = state.upgrades.find((u) => u.id === "battle-power");
  if (!up) return 0;
  return (up.level + 1) * (up.effect.powerBoost ?? 0);
}

export function rarityValue(rarity: string): number {
  return rarityScale(rarity as any);
}
