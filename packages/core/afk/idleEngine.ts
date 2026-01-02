import { combineRewards } from "./economyEngine.js";
import { createInitialState, clonePlayerState, DEFAULT_REWARD } from "./state.js";
import { IdleTickResult, PlayerState, TickContext } from "./types.js";

export function runIdleTicks(state: PlayerState, ctx: TickContext): IdleTickResult {
  const ticks = computeTicks(state.idle.lastSeenAt, ctx.now, ctx.tickMs, ctx.offlineCapHours);
  if (ticks <= 0) {
    return { state, rewards: DEFAULT_REWARD, ticks: 0 };
  }

  const working = clonePlayerState(state);
  const factor = (ticks * ctx.tickMs) / 60000;
  const rewards = {
    gold: Math.max(0, working.idle.ratePerMinute.gold * factor),
    exp: Math.max(0, working.idle.ratePerMinute.exp * factor),
    materials: Math.max(0, working.idle.ratePerMinute.materials * factor),
  };
  working.idle.bank = combineRewards(working.idle.bank, rewards);
  working.idle.lastSeenAt = state.idle.lastSeenAt + ticks * ctx.tickMs;

  return { state: working, rewards, ticks };
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
