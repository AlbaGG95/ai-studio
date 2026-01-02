import assert from "node:assert/strict";
import test from "node:test";
import {
  AFK_STAGES,
  applyAfkOfflineProgress,
  applyAfkVictory,
  createAfkPlayer,
  runAfkTicks,
  simulateAfkCombat,
} from "../index.js";

const NOW = Date.now();

test("combat win unlocks next stage and grants rewards", () => {
  const player = createAfkPlayer(NOW);
  const stage = AFK_STAGES[0];
  const combat = simulateAfkCombat(player.heroes.slice(0, 5), stage, player.upgrades, { turnLimit: 15 }, () => 0.95);
  const progressed = applyAfkVictory(player, stage);
  assert.equal(combat.result, "win");
  assert(progressed.campaign.unlockedStageIds.includes(AFK_STAGES[1].id), "next stage unlocked");
  assert(progressed.resources.gold > player.resources.gold, "rewards granted");
});

test("idle ticks accrue banked gold and respect 8h cap", () => {
  const player = createAfkPlayer(NOW);
  const result = runAfkTicks(player, {
    now: NOW + 9 * 60 * 60 * 1000,
    tickMs: 1000,
    offlineCapHours: 8,
  });
  assert(result.rewards.gold >= 0, "rewards computed");
  assert(result.state.idle.bank.gold > 0, "bank increments");
  assert(result.ticks <= 8 * 60 * 60, "capped at 8h");
});

test("offline sync replays progress", () => {
  const player = createAfkPlayer(NOW);
  const res = applyAfkOfflineProgress(player, NOW + 2 * 60 * 60 * 1000, {
    tickMs: 1000,
    offlineCapHours: 8,
  });
  assert(res.ticks > 0, "ticks applied");
  assert(res.state.idle.bank.gold > player.idle.bank.gold, "bank grows after sync");
});

test("claiming idle bank increases resources", () => {
  const player = createAfkPlayer(NOW);
  const res = runAfkTicks(player, { now: NOW + 5_000, tickMs: 1000, offlineCapHours: 1 });
  const goldBefore = res.state.resources.gold;
  const claimGold = res.state.idle.bank.gold;
  const claimed = {
    ...res.state,
    resources: {
      ...res.state.resources,
      gold: res.state.resources.gold + claimGold,
    },
    idle: { ...res.state.idle, bank: { gold: 0, exp: 0, materials: 0 } },
  };
  assert(claimed.resources.gold > goldBefore, "claim should increase resources");
});
