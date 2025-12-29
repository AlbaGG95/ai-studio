import assert from "node:assert/strict";
import test from "node:test";
import { IdleRpgEngine } from "../engine/engine.js";

const NOW = Date.now();

test("engine is deterministic with the same seed and ticks", () => {
  const engineA = IdleRpgEngine.create(42, NOW);
  const engineB = IdleRpgEngine.create(42, NOW);

  engineA.simulateTicks(25, NOW);
  engineB.simulateTicks(25, NOW);

  const stateA = engineA.getState();
  const stateB = engineB.getState();

  assert.equal(stateA.player.campaign.currentStage, stateB.player.campaign.currentStage);
  assert.equal(stateA.player.resources.gold, stateB.player.resources.gold);
  assert.equal(stateA.player.items.length, stateB.player.items.length);
});

test("combat resolves and advances stages", () => {
  const engine = IdleRpgEngine.create("advance", NOW);
  const initialStage = engine.getState().player.campaign.currentStage;

  const sim = engine.simulateTicks(60, NOW);
  assert(sim.player.campaign.currentStage > initialStage, "stage should advance after combat");
  assert(sim.player.resources.gold > 0, "player should earn gold");
});

test("save -> load -> continue keeps progress", () => {
  const seed = 99;
  const engine = IdleRpgEngine.create(seed, NOW);
  engine.simulateTicks(30, NOW);
  const saved = engine.getState();

  const restored = IdleRpgEngine.fromState(saved);
  const continued = restored.simulateTicks(10, NOW + 2000);

  assert(continued.player.resources.gold >= saved.player.resources.gold);
  assert(continued.player.campaign.currentStage >= saved.player.campaign.currentStage);
});

test("AFK rewards accumulate and can be claimed", () => {
  const engine = IdleRpgEngine.create("afk", NOW);
  const before = engine.getState().player.resources.gold;

  const offlineTicks = engine.syncOffline(NOW + 4 * 60 * 60 * 1000);
  assert(offlineTicks.ticks > 0, "offline ticks should accumulate");

  const claimed = engine.claimAfkRewards(NOW + 4 * 60 * 60 * 1000);
  assert(claimed.gold > 0, "afk gold should be claimable");
  assert(engine.getState().player.resources.gold > before, "resources should increase after claim");
});

test("Smoke: generate -> simulate -> save -> reload -> claim AFK", () => {
  const engine = IdleRpgEngine.create("smoke", NOW);
  const sim = engine.simulateTicks(40, NOW);
  assert(sim.ticksRan === 40);

  const saved = engine.getState();
  const reload = IdleRpgEngine.fromState(saved);
  const claim = reload.claimAfkRewards(NOW + 2 * 60 * 60 * 1000);
  assert(claim.gold >= 0 && claim.xp >= 0);
  const after = reload.simulateTicks(10, NOW + 2 * 60 * 60 * 1000);
  assert(after.player.campaign.currentStage >= saved.player.campaign.currentStage);
});
