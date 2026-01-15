import assert from "node:assert/strict";
import test from "node:test";
import { simulateCombat as simulateAfkCombat } from "../afk/combatEngine.js";

const STAGE: any = {
  id: "1-1",
  chapter: 1,
  index: 1,
  recommendedPower: 10,
  enemyPower: 5,
  reward: { gold: 1, exp: 1, materials: 1 },
  unlocked: true,
};

function makeHero(overrides: Partial<any> = {}) {
  return {
    id: "h1",
    name: "TestHero",
    level: 1,
    rarity: "common" as const,
    role: "fighter" as const,
    power: 10,
    stats: { hp: 120, atk: 4, def: 20, speed: 90 },
    visualSeed: "seed",
    ...overrides,
  };
}

test("combat ends even in stalemate with timeout", () => {
  const hero = makeHero({ atk: 1, stats: { hp: 200, atk: 1, def: 40, speed: 80 } });
  const summary = simulateAfkCombat([hero], { ...STAGE, enemyPower: 50 }, [], { turnLimit: 10 });
  assert(summary.result === "win" || summary.result === "loss" || summary.result === "timeout");
  assert(summary.turns <= 10, "should respect turn cap");
});

test("combat wins when enemies eliminated", () => {
  const hero = makeHero({ atk: 400, stats: { hp: 500, atk: 400, def: 5, speed: 120 } });
  const summary = simulateAfkCombat([hero], { ...STAGE, enemyPower: 1 }, [], { turnLimit: 5 });
  assert.equal(summary.result, "win");
});
