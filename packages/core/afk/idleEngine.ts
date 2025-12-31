import { combineRewards, grantReward, tickIncome } from "./economyEngine.js";
import { advanceStage, applyStageProgress, applyStageReward, handleMilestoneUnlocks } from "./progressionEngine.js";
import { createInitialState, clonePlayerState, emptyReward } from "./state.js";
import { CombatSummary, IdleTickResult, PlayerState, Reward, RngSource, TickContext } from "./types.js";
import { simulateCombat } from "./combatEngine.js";

const DEFAULT_RNG: RngSource = () => Math.random();

export function runIdleTicks(
  state: PlayerState,
  ctx: TickContext,
  baseTickReward: Reward = { gold: 1, essence: 0 },
  rng: RngSource = DEFAULT_RNG
): IdleTickResult {
  const ticks = computeTicks(state.lastTickAt, ctx.now, ctx.tickMs, ctx.offlineCapHours);
  if (ticks <= 0) {
    return { state, rewards: emptyReward(), ticks: 0 };
  }

  let working = clonePlayerState(state);
  let accumulated = emptyReward();
  let lastCombat: CombatSummary | undefined;
  let stageCleared = false;

  for (let i = 0; i < ticks; i++) {
    const income = tickIncome(working, baseTickReward);
    accumulated = combineRewards(accumulated, income);
    working = grantReward(working, income, "bank");

    const speedBoost = getStageSpeed(working);
    const { stage, cleared } = applyStageProgress(working.stage, ctx.progressPerTick * speedBoost);
    working.stage = stage;

    if (cleared) {
      lastCombat = simulateCombat(
        working.heroes.filter((hero) => working.activeHeroIds.includes(hero.id)),
        working.stage,
        working.upgrades,
        { timeoutResult: "timeout" },
        rng
      );

      if (lastCombat.result === "win") {
        working = applyStageReward(working, working.stage.reward);
        working.stage = advanceStage(working.stage);
        stageCleared = true;
        working = handleMilestoneUnlocks(working);
      } else {
        working.stage.progress = 0;
      }
    }
  }

  working.lastTickAt = state.lastTickAt + ticks * ctx.tickMs;

  return {
    state: working,
    rewards: working.afkBank,
    ticks,
    stageCleared,
    combat: lastCombat,
  };
}

export function applyOfflineProgress(state: PlayerState, now: number, ctx: Omit<TickContext, "now">): IdleTickResult {
  const tickCtx: TickContext = { ...ctx, now };
  return runIdleTicks(state, tickCtx);
}

export function bootstrapPlayer(now: number): PlayerState {
  return createInitialState(now);
}

function computeTicks(lastTickAt: number, now: number, tickMs: number, capHours: number): number {
  const elapsed = now - lastTickAt;
  if (elapsed <= 0) return 0;
  const ticks = Math.floor(elapsed / tickMs);
  const cap = Math.floor((capHours * 60 * 60 * 1000) / tickMs);
  return Math.min(ticks, cap);
}

function getStageSpeed(state: PlayerState): number {
  const speedUpgrade = state.upgrades.find((u) => u.effect.stageSpeed);
  if (!speedUpgrade) return 1;
  return 1 + (speedUpgrade.effect.stageSpeed ?? 0) * Math.max(1, speedUpgrade.level);
}
