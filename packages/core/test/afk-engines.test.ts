import assert from "node:assert/strict";
import test from "node:test";
import {
  applyAfkOfflineProgress,
  createAfkPlayer,
  runAfkTicks,
  simulateAfkCombat,
  applyAfkUpgrade,
} from "../index.js";

const NOW = Date.now();

test("idle ticks accrue resources and advance stages with injected RNG", () => {
  const player = createAfkPlayer(NOW);
  const result = runAfkTicks(
    player,
    { now: NOW + 10_000, tickMs: 1_000, offlineCapHours: 1, progressPerTick: 0.25 },
    { gold: 1, essence: 0 },
    () => 0.5
  );

  assert.equal(result.ticks, 10);
  assert(result.rewards.gold > 0, "should bank gold");
  assert(result.state.stage.index >= 1, "stage stays valid");
  assert(result.stageCleared, "stage should clear at least once");
});

test("combat honors injected RNG and can produce a loss", () => {
  const player = createAfkPlayer(NOW);
  const stage = { ...player.stage, enemyPower: 100 };
  const combat = simulateAfkCombat(player.heroes, stage, player.upgrades, { turnLimit: 3 }, () => 0);
  assert.equal(combat.result, "loss");
});

test("offline sync respects cap", () => {
  const player = createAfkPlayer(NOW);
  const res = applyAfkOfflineProgress(player, NOW + 6 * 60 * 60 * 1000, {
    tickMs: 1_000,
    offlineCapHours: 4,
    progressPerTick: 0.1,
  });
  assert(res.ticks <= 4 * 60 * 60, "ticks should be capped by offline hours");
});

test("upgrades consume resources and increase level", () => {
  const player = createAfkPlayer(NOW);
  const withIncome = {
    ...player,
    resources: { gold: 100, essence: 20 },
  };
  const upgraded = applyAfkUpgrade(withIncome, withIncome.upgrades[0].id);
  assert(upgraded.upgrades[0].level === withIncome.upgrades[0].level + 1);
  assert(upgraded.resources.gold < withIncome.resources.gold);
});
