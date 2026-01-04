import { rarityScale } from "./heroFactory.js";
import { simulateCombat } from "./combatEngine.js";
import {
  BattleUnit,
  CombatConfig,
  CombatEvent,
  CombatSummary,
  Hero,
  RngSource,
  Stage,
  Upgrade,
} from "./types.js";
import { makeRng } from "./seed.js";

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

function computePowerBoost(upgrades: Upgrade[]) {
  const powerUpgrade = upgrades.find((u) => u.effect.powerBoost);
  return powerUpgrade ? (powerUpgrade.effect.powerBoost ?? 0) * (powerUpgrade.level + 1) : 0;
}

function cloneUnits(units: BattleUnit[]) {
  return units.map((u) => ({ ...u }));
}

function findTarget(units: BattleUnit[], id?: string) {
  if (!id) return undefined;
  return units.find((u) => u.heroId === id);
}

function applyEvent(event: CombatEvent, allies: BattleUnit[], enemies: BattleUnit[]) {
  const target = findTarget(allies, event.targetId) ?? findTarget(enemies, event.targetId);
  const source = findTarget(allies, event.sourceId) ?? findTarget(enemies, event.sourceId);

  if (event.kind === "attack" || event.kind === "ultimate") {
    if (target) {
      target.hp = Math.max(0, target.hp - event.amount);
      if (target.hp <= 0 || event.kind === "death") {
        target.alive = false;
      }
    }
  } else if (event.kind === "heal") {
    if (target) {
      target.hp = Math.min(target.maxHp, target.hp + event.amount);
    }
  } else if (event.kind === "death") {
    if (target) target.alive = false;
    if (!target && source) source.alive = false;
  }
}

export interface CombatFrame {
  timestamp: number;
  allies: BattleUnit[];
  enemies: BattleUnit[];
  events: CombatEvent[];
  result?: CombatSummary["result"];
}

export interface CombatTimeline {
  frames: CombatFrame[];
  summary: CombatSummary;
}

export function buildInitialUnits(heroes: Hero[], stage: Stage, upgrades: Upgrade[] = [], rng: RngSource) {
  const powerBoost = computePowerBoost(upgrades);
  const allies = heroes.slice(0, 5).map((hero, idx) => buildUnit(hero, "ally", idx, powerBoost));
  const enemies = new Array(5).fill(null).map((_, idx) => buildEnemy(stage, idx, rng));
  return { allies, enemies };
}

export function simulateCombatTimeline(
  heroes: Hero[],
  stage: Stage,
  upgrades: Upgrade[] = [],
  config: CombatConfig = {},
  seed: string | number = stage.id
): CombatTimeline {
  const rngForUnits = makeRng(seed);
  const rngForCombat = makeRng(seed);
  const initial = buildInitialUnits(heroes, stage, upgrades, rngForUnits);
  const summary = simulateCombat(heroes, stage, upgrades, config, rngForCombat);

  const eventsByTime = new Map<number, CombatEvent[]>();
  for (const event of summary.events) {
    const list = eventsByTime.get(event.timestamp) ?? [];
    list.push(event);
    eventsByTime.set(event.timestamp, list);
  }

  const frames: CombatFrame[] = [];
  let allies = cloneUnits(initial.allies);
  let enemies = cloneUnits(initial.enemies);
  frames.push({ timestamp: 0, allies: cloneUnits(allies), enemies: cloneUnits(enemies), events: [] });

  const timestamps = Array.from(eventsByTime.keys()).sort((a, b) => a - b);
  for (const timestamp of timestamps) {
    const events = eventsByTime.get(timestamp) ?? [];
    for (const event of events) {
      applyEvent(event, allies, enemies);
    }
    frames.push({
      timestamp,
      allies: cloneUnits(allies),
      enemies: cloneUnits(enemies),
      events,
    });
  }

  if (frames.length === 0 || frames[frames.length - 1].timestamp !== (summary.durationMs ?? 0)) {
    frames.push({
      timestamp: summary.durationMs ?? (timestamps[timestamps.length - 1] ?? 0),
      allies: summary.allies ? cloneUnits(summary.allies) : cloneUnits(allies),
      enemies: summary.enemies ? cloneUnits(summary.enemies) : cloneUnits(enemies),
      events: [],
    });
  }

  if (frames.length > 0) {
    frames[frames.length - 1].result = summary.result;
  }

  return {
    frames,
    summary,
  };
}
