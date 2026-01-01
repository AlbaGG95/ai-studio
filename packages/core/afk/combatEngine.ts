import { Hero, CombatConfig, CombatSummary, RngSource, Stage, Upgrade, BattleUnit, CombatEvent } from "./types.js";
import { rarityScale } from "./heroFactory.js";

const DEFAULT_RNG: RngSource = () => Math.random();

const BASE_TICK_MS = 650;
const DEFAULT_TURN_LIMIT = 120;
const MAX_DURATION_MS = 45_000;
const TURN_DAMAGE_SCALER_START = 80;

function laneFromIndex(idx: number): "front" | "back" {
  return idx < 2 ? "front" : "back";
}

function buildUnit(hero: Hero, team: "ally" | "enemy", idx: number, powerBoost: number): BattleUnit {
  const rarityBoost = rarityScale(hero.rarity);
  return {
    heroId: hero.id,
    name: hero.name,
    role: hero.role,
    rarity: hero.rarity,
    team,
    lane: laneFromIndex(idx),
    maxHp: Math.round(hero.stats.hp * rarityBoost * (1 + powerBoost)),
    hp: Math.round(hero.stats.hp * rarityBoost * (1 + powerBoost)),
    atk: Math.round(hero.stats.atk * (1 + powerBoost)),
    def: Math.round(hero.stats.def * (1 + powerBoost * 0.5)),
    energy: 0,
    speed: hero.stats.speed,
    alive: true,
  };
}

function buildEnemy(stage: Stage, idx: number, rng: RngSource): BattleUnit {
  const randomPower = stage.enemyPower * (0.82 + rng() * 0.35);
  const hp = Math.max(120, randomPower * 3.4);
  const atk = Math.max(18, randomPower * 0.55);
  const def = Math.max(6, randomPower * 0.22);
  return {
    heroId: `enemy-${stage.id}-${idx}`,
    name: `Enemigo ${stage.index}-${idx + 1}`,
    role: idx === 0 ? "tank" : idx >= 3 ? "ranger" : "fighter",
    rarity: "rare",
    team: "enemy",
    lane: laneFromIndex(idx),
    maxHp: Math.round(hp),
    hp: Math.round(hp),
    atk: Math.round(atk),
    def: Math.round(def),
    energy: 0,
    speed: 90 + idx * 4,
    alive: true,
  };
}

function pickTarget(
  unit: BattleUnit,
  enemies: BattleUnit[],
  rng: RngSource
): BattleUnit | undefined {
  const alive = enemies.filter((e) => e.alive);
  if (!alive.length) return undefined;
  if (unit.role === "tank") {
    const front = alive.find((u) => u.lane === "front");
    return front ?? alive[0];
  }
  if (unit.role === "ranger" || unit.role === "mage") {
    const back = alive.filter((u) => u.lane === "back");
    if (back.length) {
      return back[Math.floor(rng() * back.length)];
    }
  }
  return alive[Math.floor(rng() * alive.length)];
}

function pickHealTarget(allies: BattleUnit[]): BattleUnit | undefined {
  const alive = allies.filter((a) => a.alive);
  if (!alive.length) return undefined;
  return alive.reduce((acc, curr) => {
    const ratio = curr.hp / curr.maxHp;
    const best = acc.hp / acc.maxHp;
    return ratio < best ? curr : acc;
  }, alive[0]);
}

function applyDamage(source: BattleUnit, target: BattleUnit, rng: RngSource, isUltimate: boolean, turn: number) {
  const variance = 0.88 + rng() * 0.24;
  const crit = rng() > 0.87;
  const power = isUltimate ? 1.6 : 1;
  const raw = source.atk * power * variance;
  const turnRamp = turn > TURN_DAMAGE_SCALER_START ? 1 + (turn - TURN_DAMAGE_SCALER_START) * 0.01 : 1;
  const mitigated = Math.max(8, (raw - target.def * 0.45) * turnRamp);
  const value = Math.round(mitigated * (crit ? 1.5 : 1));
  target.hp = Math.max(0, target.hp - value);
  return { value, crit };
}

function applyHeal(source: BattleUnit, target: BattleUnit, rng: RngSource, isUltimate: boolean, turn: number) {
  const variance = 0.9 + rng() * 0.25;
  const power = isUltimate ? 1.6 : 1.1;
  const turnRamp = turn > TURN_DAMAGE_SCALER_START ? 1 + (turn - TURN_DAMAGE_SCALER_START) * 0.005 : 1;
  const amount = Math.round(source.atk * power * variance * turnRamp);
  const prev = target.hp;
  target.hp = Math.min(target.maxHp, target.hp + amount);
  return target.hp - prev;
}

function alive(team: BattleUnit[]) {
  return team.some((u) => u.alive);
}

export function simulateCombat(
  heroes: Hero[],
  stage: Stage,
  upgrades: Upgrade[] = [],
  config: CombatConfig = {},
  rng: RngSource = DEFAULT_RNG
): CombatSummary {
  const powerUpgrade = upgrades.find((u) => u.effect.powerBoost);
  const powerBoost = powerUpgrade ? (powerUpgrade.effect.powerBoost ?? 0) * (powerUpgrade.level + 1) : 0;
  const allies: BattleUnit[] = heroes.slice(0, 5).map((hero, idx) => buildUnit(hero, "ally", idx, powerBoost));
  const enemies: BattleUnit[] = new Array(5).fill(null).map((_, idx) => buildEnemy(stage, idx, rng));

  const turnLimit = config.turnLimit ?? DEFAULT_TURN_LIMIT;
  let turns = 0;
  let damageDealt = 0;
  let damageTaken = 0;
  let timestamp = 0;
  const events: CombatEvent[] = [];
  const startTime = Date.now();

  while (turns < turnLimit && alive(allies) && alive(enemies)) {
    turns += 1;
    timestamp += config.tickMs ?? BASE_TICK_MS;
    if (timestamp >= MAX_DURATION_MS || Date.now() - startTime >= MAX_DURATION_MS) {
      break;
    }
    const order = [...allies, ...enemies]
      .filter((u) => u.alive)
      .sort((a, b) => b.speed - a.speed);

    for (const unit of order) {
      if (!unit.alive) continue;
      unit.energy += 18 + unit.speed * 0.08;
      const isUltimate = unit.energy >= 100;
      let target: BattleUnit | undefined;
      let amount = 0;
      let kind: CombatEvent["kind"] = "attack";

      if (unit.role === "support") {
        target = pickHealTarget(unit.team === "ally" ? allies : enemies);
        if (target) {
          amount = applyHeal(unit, target, rng, isUltimate, turns);
          kind = "heal";
        }
      } else {
        target = pickTarget(unit, unit.team === "ally" ? enemies : allies, rng);
        if (target) {
          const { value, crit } = applyDamage(unit, target, rng, isUltimate, turns);
          amount = value;
          kind = isUltimate ? "ultimate" : "attack";
          if (unit.team === "ally") {
            damageDealt += value;
          } else {
            damageTaken += value;
          }
          events.push({
            kind,
            sourceId: unit.heroId,
            targetId: target.heroId,
            amount: value,
            crit,
            timestamp,
            team: unit.team,
          });
          if (target.hp <= 0) {
            target.alive = false;
            events.push({
              kind: "death",
              sourceId: target.heroId,
              amount: 0,
              timestamp,
              team: target.team,
            });
          }
        }
      }

      if (kind === "heal" && target) {
        events.push({
          kind,
          sourceId: unit.heroId,
          targetId: target.heroId,
          amount,
          timestamp,
          team: unit.team,
        });
      }

      unit.energy = isUltimate ? 0 : unit.energy + 12;
      if (!alive(allies) || !alive(enemies)) break;
    }
  }

  const decideByHp = () => {
    const allyHpPct =
      allies.reduce((acc, u) => acc + u.hp, 0) / Math.max(1, allies.reduce((acc, u) => acc + u.maxHp, 0));
    const enemyHpPct =
      enemies.reduce((acc, u) => acc + u.hp, 0) / Math.max(1, enemies.reduce((acc, u) => acc + u.maxHp, 0));
    if (allyHpPct === enemyHpPct) return "loss";
    return allyHpPct > enemyHpPct ? "win" : "loss";
  };

  const result: CombatSummary["result"] =
    alive(allies) && !alive(enemies)
      ? "win"
      : alive(enemies) && !alive(allies)
      ? "loss"
      : decideByHp();

  return {
    result,
    turns,
    damageDealt,
    damageTaken,
    events,
    allies: allies.map((u) => ({ ...u })),
    enemies: enemies.map((u) => ({ ...u })),
    durationMs: timestamp,
  };
}
