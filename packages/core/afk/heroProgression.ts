import { rarityValue } from "./state.js";
import { canAfford, payCost } from "./economyEngine.js";
import { Hero, PlayerState, Reward } from "./types.js";

export function levelUpCost(hero: Hero): Reward {
  return {
    gold: 60 + hero.level * 24,
    exp: 18 + hero.level * 6,
    materials: Math.max(2, Math.round(hero.level / 2)),
  };
}

function bumpStats(hero: Hero): Hero {
  const levelMult = 1 + hero.level * 0.04;
  const rarityMult = rarityValue(hero.rarity) || 1;
  const nextStats = {
    hp: Math.round(hero.stats.hp * 1.08 * levelMult * rarityMult),
    atk: Math.round(hero.stats.atk * 1.05 * levelMult * rarityMult),
    def: Math.round(hero.stats.def * 1.04 * levelMult * rarityMult),
    speed: hero.stats.speed,
  };
  const nextPower = Math.round(nextStats.hp / 8 + nextStats.atk * 2.4 + nextStats.def * 1.5);
  return { ...hero, level: hero.level + 1, stats: nextStats, power: nextPower };
}

export function levelUpHero(state: PlayerState, heroId: string): PlayerState {
  const hero = state.heroes.find((h) => h.id === heroId);
  if (!hero) return state;
  const cost = levelUpCost(hero);
  if (!canAfford(state, cost)) return state;
  const next = payCost(state, cost);
  const target = next.heroes.find((h) => h.id === heroId);
  if (!target) return state;
  const leveled = bumpStats(target);
  Object.assign(target, leveled);
  return next;
}
