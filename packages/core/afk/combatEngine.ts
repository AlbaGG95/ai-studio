import { Hero, CombatConfig, CombatSummary, RngSource, Stage, Upgrade } from "./types.js";
import { getUpgradeMultiplier } from "./economyEngine.js";

const DEFAULT_RNG: RngSource = () => Math.random();

export function simulateCombat(
  heroes: Hero[],
  stage: Stage,
  upgrades: Upgrade[] = [],
  config: CombatConfig = {},
  rng: RngSource = DEFAULT_RNG
): CombatSummary {
  const heroPower = heroes.reduce((acc, hero) => acc + hero.power, 0);
  const combatBoost = getUpgradeMultiplier(upgrades, "combatPower", 1);
  const enemyPower = stage.enemyPower;

  const turnLimit = config.turnLimit ?? 12;
  let turns = 0;
  let damageDealt = 0;
  let damageTaken = 0;

  while (turns < turnLimit) {
    turns += 1;
    const swing = 0.85 + rng() * 0.3;
    const playerHit = heroPower * combatBoost * swing;
    const enemyHit = enemyPower * (1 + (rng() - 0.5) * 0.1);

    damageDealt += playerHit;
    damageTaken += enemyHit;

    if (playerHit >= enemyPower) {
      return { result: "win", turns, damageDealt, damageTaken };
    }
    if (enemyHit >= heroPower * 1.2) {
      return { result: "loss", turns, damageDealt, damageTaken };
    }
  }

  return {
    result: config.timeoutResult ?? "timeout",
    turns,
    damageDealt,
    damageTaken,
  };
}
