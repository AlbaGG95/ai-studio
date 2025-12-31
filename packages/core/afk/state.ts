import { PlayerState, Reward, Stage } from "./types.js";

const DEFAULT_REWARD: Reward = { gold: 0, essence: 0 };

export function clonePlayerState(state: PlayerState): PlayerState {
  return {
    resources: { ...state.resources },
    heroes: state.heroes.map((hero) => ({ ...hero })),
    activeHeroIds: [...state.activeHeroIds],
    stage: cloneStage(state.stage),
    unlocks: { ...state.unlocks },
    upgrades: state.upgrades.map((upgrade) => ({
      ...upgrade,
      cost: { ...upgrade.cost },
      effect: { ...upgrade.effect },
    })),
    lastTickAt: state.lastTickAt,
    afkBank: { ...DEFAULT_REWARD, ...(state.afkBank ?? DEFAULT_REWARD) },
  };
}

export function createInitialState(now: number): PlayerState {
  const starterStage: Stage = {
    id: "stage-1",
    index: 1,
    enemyPower: 10,
    reward: { gold: 5, essence: 1 },
    progress: 0,
    milestone: true,
  };

  return {
    resources: { gold: 0, essence: 0 },
    heroes: [
      {
        id: "hero-1",
        name: "Nova",
        level: 1,
        power: 12,
        role: "fighter",
        rarity: "common",
      },
    ],
    activeHeroIds: ["hero-1"],
    stage: starterStage,
    unlocks: { home: true },
    upgrades: [
      {
        id: "u-resource",
        name: "Resource Flow",
        level: 0,
        cost: { gold: 10, essence: 1 },
        effect: { resourceRate: 0.1 },
        unlocked: true,
      },
    ],
    lastTickAt: now,
    afkBank: { ...DEFAULT_REWARD },
  };
}

export function emptyReward(): Reward {
  return { ...DEFAULT_REWARD };
}

function cloneStage(stage: Stage): Stage {
  return {
    ...stage,
    reward: { ...stage.reward },
  };
}
