import { DeterministicRng } from "./rng.js";
import { ENEMIES, HEROES, ITEMS, RARITY_ORDER, STAGES } from "./content.js";
import {
  Ability,
  CombatLogEntry,
  CombatState,
  EngineConfig,
  EngineState,
  Item,
  EnemyTemplate,
  PlayerState,
  StageDefinition,
  Stats,
  UnitRuntimeState,
  UnitTemplate,
} from "./types.js";

const ENGINE_VERSION = "0.1.0";
const LOG_LIMIT = 50;

export const DEFAULT_ENGINE_CONFIG: EngineConfig = {
  tickMs: 400,
  attackIntervalTicks: 2,
  ultimateThreshold: 100,
  energyPerTick: 2,
  energyPerAttack: 14,
  ultimateMultiplier: 1.75,
  damageVariance: 0.12,
  afkGoldPerTick: 3,
  afkXpPerTick: 1,
  afkCapHours: 10,
  gacha: {
    pityEpic: 30,
    pityLegendary: 120,
    rates: {
      common: 0.58,
      rare: 0.3,
      epic: 0.1,
      legendary: 0.02,
    },
  },
};

type Side = "player" | "enemy";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function safeLog(log: CombatLogEntry[], entry: CombatLogEntry) {
  log.push(entry);
  if (log.length > LOG_LIMIT) {
    log.shift();
  }
}

function scaleStats(base: Stats, scale: number): Stats {
  return {
    hp: Math.max(1, Math.round(base.hp * scale)),
    atk: Math.max(1, Math.round(base.atk * scale)),
    def: Math.max(0, Math.round(base.def * scale)),
    crit: base.crit,
  };
}

function instantiateUnit(
  template: UnitTemplate,
  side: Side,
  scale: number,
  rng: DeterministicRng
): UnitRuntimeState {
  const stats = scaleStats(template.baseStats, scale);
  return {
    id: `${side}-${template.id}-${Math.floor(rng.next() * 1e6)
      .toString(36)
      .slice(0, 5)}`,
    templateId: template.id,
    side,
    name: template.name,
    role: template.role,
    rarity: template.rarity,
    position: template.position,
    maxHp: stats.hp,
    hp: stats.hp,
    atk: stats.atk,
    def: stats.def,
    energy: 0,
    attackCooldown: 0,
    alive: true,
  };
}

function pickTemplateById(templates: UnitTemplate[], id: string): UnitTemplate | undefined {
  return templates.find((h) => h.id === id);
}

function resolveStage(stageNumber: number): StageDefinition {
  const base = STAGES[(stageNumber - 1) % STAGES.length];
  const loops = Math.floor((stageNumber - 1) / STAGES.length);
  const scale = 1 + loops * 0.15;
  return {
    ...base,
    level: base.level + loops,
    reward: {
      gold: Math.round(base.reward.gold * (1 + loops * 0.2)),
      xp: Math.round(base.reward.xp * (1 + loops * 0.15)),
    },
    enemyLineup: base.enemyLineup,
  };
}

function chooseTarget(opponents: UnitRuntimeState[], preferFront = true): UnitRuntimeState | null {
  const alive = opponents.filter((u) => u.alive);
  if (alive.length === 0) return null;
  if (!preferFront) return alive[0];
  const front = alive.find((u) => u.position === "front");
  return front || alive[0];
}

function applyDamage(
  rng: DeterministicRng,
  attacker: UnitRuntimeState,
  defender: UnitRuntimeState,
  ability: Ability,
  config: EngineConfig
) {
  const variance = 1 - config.damageVariance / 2 + rng.next() * config.damageVariance;
  const base = attacker.atk * ability.powerMultiplier;
  const mitigated = Math.max(1, Math.round((base - defender.def * 0.35) * variance));
  defender.hp = Math.max(0, defender.hp - mitigated);
  return mitigated;
}

function applyHeal(target: UnitRuntimeState, amount: number) {
  if (!target.alive) return 0;
  const prev = target.hp;
  target.hp = Math.min(target.maxHp, target.hp + amount);
  return target.hp - prev;
}

function findLowestHp(heroes: UnitRuntimeState[]): UnitRuntimeState | null {
  const alive = heroes.filter((u) => u.alive);
  if (alive.length === 0) return null;
  return alive.reduce((acc, curr) => (curr.hp / curr.maxHp < acc.hp / acc.maxHp ? curr : acc), alive[0]);
}

function rewardItems(rng: DeterministicRng, rarity: string): Item {
  const candidates = ITEMS.filter((i) => i.rarity === rarity);
  const pool = candidates.length > 0 ? candidates : ITEMS;
  return rng.pick(pool);
}

export class IdleRpgEngine {
  private rng: DeterministicRng;
  private state: EngineState;

  constructor(state: EngineState, rng: DeterministicRng) {
    this.state = state;
    this.rng = rng;
  }

  static create(seedInput?: number | string, now = Date.now()): IdleRpgEngine {
    const seed = seedInput ?? now;
    const rng = new DeterministicRng(seed);
    const config = clone(DEFAULT_ENGINE_CONFIG);
    const player = IdleRpgEngine.buildPlayer(config, now);
    const combat = IdleRpgEngine.buildEmptyCombat(player.campaign.currentStage);
    const timeline = { lastTickAt: now };
    const state: EngineState = {
      version: ENGINE_VERSION,
      seed: typeof seed === "number" ? seed : DeterministicRng.normalizeSeed(seed),
      rngState: rng.snapshot().state,
      config,
      player,
      combat,
      timeline,
    };
    return new IdleRpgEngine(state, rng);
  }

  static fromState(raw: EngineState): IdleRpgEngine {
    const state = clone(raw);
    const rng = DeterministicRng.fromSnapshot({ state: raw.rngState });
    return new IdleRpgEngine(state, rng);
  }

  private static buildEmptyCombat(stage: number): CombatState {
    return {
      stage,
      inProgress: false,
      tick: 0,
      playerTeam: [],
      enemyTeam: [],
      log: [],
    };
  }

  private static buildPlayer(config: EngineConfig, now: number): PlayerState {
    return {
      heroes: clone(HEROES),
      items: [],
      resources: {
        gold: 500,
        xp: 0,
        gems: 300,
      },
      campaign: { currentStage: 1, bestStage: 1 },
      afk: {
        bankedGold: 0,
        bankedXp: 0,
        lastClaimAt: now,
        capHours: config.afkCapHours,
      },
      gacha: { pityEpic: 0, pityLegendary: 0 },
      activeTeam: HEROES.slice(0, 5).map((h) => h.id),
    };
  }

  getState(): EngineState {
    return clone({
      ...this.state,
      rngState: this.rng.snapshot().state,
    });
  }

  syncOffline(now = Date.now()) {
    const deltaMs = Math.max(0, now - this.state.timeline.lastTickAt);
    if (deltaMs <= 0) {
      return { ticks: 0, gold: 0, xp: 0, cappedMs: 0 };
    }
    const capMs = this.state.player.afk.capHours * 60 * 60 * 1000;
    const cappedMs = Math.min(deltaMs, capMs);
    const ticks = Math.floor(cappedMs / this.state.config.tickMs);
    const goldGain =
      ticks *
      this.state.config.afkGoldPerTick *
      (1 + this.state.player.campaign.currentStage * 0.05);
    const xpGain = ticks * this.state.config.afkXpPerTick;

    this.state.player.afk.bankedGold += Math.floor(goldGain);
    this.state.player.afk.bankedXp += Math.floor(xpGain);
    this.state.timeline.lastTickAt = now;
    return { ticks, gold: Math.floor(goldGain), xp: Math.floor(xpGain), cappedMs };
  }

  claimAfkRewards(now = Date.now()) {
    this.syncOffline(now);
    const { bankedGold, bankedXp } = this.state.player.afk;
    this.state.player.resources.gold += bankedGold;
    this.state.player.resources.xp += bankedXp;
    this.state.player.afk.bankedGold = 0;
    this.state.player.afk.bankedXp = 0;
    this.state.player.afk.lastClaimAt = now;
    return { gold: bankedGold, xp: bankedXp };
  }

  simulateTicks(ticks: number, now = Date.now()) {
    const normalizedTicks = Math.max(0, Math.floor(ticks));
    const offline = this.syncOffline(now);
    if (!this.state.combat.inProgress) {
      this.startCombatForStage(this.state.player.campaign.currentStage);
    }
    for (let i = 0; i < normalizedTicks; i += 1) {
      this.processTick();
    }
    this.state.timeline.lastTickAt += normalizedTicks * this.state.config.tickMs;
    this.state.rngState = this.rng.snapshot().state;
    return {
      offlineApplied: offline,
      ticksRan: normalizedTicks,
      combat: clone(this.state.combat),
      player: clone(this.state.player),
    };
  }

  simulateDuration(ms: number, now = Date.now()) {
    const ticks = Math.floor(ms / this.state.config.tickMs);
    return this.simulateTicks(ticks, now);
  }

  private startCombatForStage(stageNumber: number) {
    const stage = resolveStage(stageNumber);
    const scale = 1 + (stageNumber - 1) * 0.08;
    const playerTeam = this.state.player.activeTeam
      .map((heroId) => pickTemplateById(this.state.player.heroes, heroId))
      .filter(Boolean)
      .slice(0, 5)
      .map((hero) => instantiateUnit(hero as UnitTemplate, "player", 1, this.rng));
    while (playerTeam.length < 5 && this.state.player.heroes[playerTeam.length]) {
      const filler = this.state.player.heroes[playerTeam.length];
      playerTeam.push(instantiateUnit(filler, "player", 1, this.rng));
    }

    const enemyTeam = stage.enemyLineup
      .slice(0, 5)
      .map((enemyId) => pickTemplateById(ENEMIES, enemyId) as EnemyTemplate | undefined)
      .filter(Boolean)
      .map((enemy) => instantiateUnit(enemy as EnemyTemplate, "enemy", scale, this.rng));

    this.state.combat = {
      stage: stageNumber,
      inProgress: true,
      tick: 0,
      playerTeam,
      enemyTeam,
      log: [],
    };
  }

  private processTick() {
    if (!this.state.combat.inProgress) {
      this.startCombatForStage(this.state.player.campaign.currentStage);
    }
    this.state.combat.tick += 1;
    const { playerTeam, enemyTeam } = this.state.combat;
    const actions: UnitRuntimeState[] = [...playerTeam, ...enemyTeam].filter((u) => u.alive);

    const handleUnit = (unit: UnitRuntimeState, opponents: UnitRuntimeState[], allies: UnitRuntimeState[]) => {
      if (!unit.alive) return;
      unit.energy += this.state.config.energyPerTick;
      if (unit.attackCooldown > 0) {
        unit.attackCooldown -= 1;
        return;
      }

      const template =
        unit.side === "player"
          ? pickTemplateById(this.state.player.heroes, unit.templateId)
          : pickTemplateById(ENEMIES, unit.templateId);

      const ability = unit.energy >= this.state.config.ultimateThreshold
        ? template?.abilities.ultimate
        : template?.abilities.basic;

      if (!ability) return;

      if (ability.target === "ally") {
        const target = findLowestHp(allies);
        if (!target) return;
        const healed = applyHeal(target, Math.round(unit.atk * ability.powerMultiplier));
        unit.energy = 0;
        unit.attackCooldown = this.state.config.attackIntervalTicks;
        safeLog(this.state.combat.log, {
          tick: this.state.combat.tick,
          actor: unit.name,
          action: "attack",
          target: target.name,
          value: healed,
        });
        return;
      }

      const target = chooseTarget(opponents, true);
      if (!target) return;

      const damage = applyDamage(this.rng, unit, target, ability, this.state.config);
      unit.energy = ability.type === "ultimate" ? 0 : unit.energy + this.state.config.energyPerAttack;
      unit.attackCooldown = this.state.config.attackIntervalTicks;

      safeLog(this.state.combat.log, {
        tick: this.state.combat.tick,
        actor: unit.name,
        action: ability.type === "ultimate" ? "ultimate" : "attack",
        target: target.name,
        value: damage,
      });

      if (target.hp <= 0) {
        target.alive = false;
        safeLog(this.state.combat.log, {
          tick: this.state.combat.tick,
          actor: target.name,
          action: "defeat",
        });
      }
    };

    for (const unit of actions) {
      if (unit.side === "player") {
        handleUnit(unit, enemyTeam, playerTeam);
      } else {
        handleUnit(unit, playerTeam, enemyTeam);
      }
      if (!this.hasLiving(enemyTeam) || !this.hasLiving(playerTeam)) {
        break;
      }
    }

    this.checkCombatResolution();
  }

  private hasLiving(team: UnitRuntimeState[]) {
    return team.some((u) => u.alive);
  }

  private checkCombatResolution() {
    const playerAlive = this.hasLiving(this.state.combat.playerTeam);
    const enemyAlive = this.hasLiving(this.state.combat.enemyTeam);
    if (playerAlive && enemyAlive) return;

    if (playerAlive && !enemyAlive) {
      this.handleVictory();
    } else if (!playerAlive && enemyAlive) {
      this.handleDefeat();
    } else {
      // draw fallback -> treat as defeat
      this.handleDefeat();
    }
  }

  private handleVictory() {
    const stage = resolveStage(this.state.combat.stage);
    const enemyTemplates = stage.enemyLineup
      .map((id) => pickTemplateById(ENEMIES, id) as EnemyTemplate | undefined)
      .filter(Boolean) as EnemyTemplate[];
    const rewardMultiplier =
      enemyTemplates.reduce((acc, enemy) => acc + (enemy.rewardMultiplier || 1), 0) /
      Math.max(1, enemyTemplates.length);

    const goldReward = Math.round(stage.reward.gold * rewardMultiplier);
    const xpReward = Math.round(stage.reward.xp * rewardMultiplier);

    this.state.player.resources.gold += goldReward;
    this.state.player.resources.xp += xpReward;

    this.state.player.campaign.currentStage += 1;
    this.state.player.campaign.bestStage = Math.max(
      this.state.player.campaign.bestStage,
      this.state.player.campaign.currentStage
    );

    const rarityReward = rewardMultiplier > 1.5 ? "rare" : "common";
    const item = rewardItems(this.rng, rarityReward);
    this.state.player.items.push(item);

    this.state.combat.inProgress = false;
    safeLog(this.state.combat.log, {
      tick: this.state.combat.tick,
      actor: "system",
      action: "defeat",
      target: "boss",
      value: goldReward,
    });
  }

  private handleDefeat() {
    this.state.combat.inProgress = false;
    this.state.combat.playerTeam = this.state.combat.playerTeam.map((unit) => ({
      ...unit,
      hp: unit.maxHp,
      alive: true,
      energy: 0,
      attackCooldown: 0,
    }));
  }

  performSummon(pulls: number) {
    const results: Item[] = [];
    for (let i = 0; i < pulls; i += 1) {
      const rarity = this.rollRarity();
      results.push(rewardItems(this.rng, rarity));
    }
    this.state.rngState = this.rng.snapshot().state;
    return results;
  }

  private rollRarity(): string {
    const pityEpic = this.state.player.gacha.pityEpic + 1;
    const pityLegendary = this.state.player.gacha.pityLegendary + 1;
    const rates = this.state.config.gacha.rates;
    let rarity: string = "common";

    const forcedLegendary = pityLegendary >= this.state.config.gacha.pityLegendary;
    const forcedEpic = pityEpic >= this.state.config.gacha.pityEpic;

    if (forcedLegendary) {
      rarity = "legendary";
    } else if (forcedEpic) {
      rarity = "epic";
    } else {
      const roll = this.rng.next();
      let acc = 0;
      for (const key of RARITY_ORDER) {
        acc += rates[key];
        if (roll <= acc) {
          rarity = key;
          break;
        }
      }
    }

    if (rarity === "legendary") {
      this.state.player.gacha.pityLegendary = 0;
      this.state.player.gacha.pityEpic = 0;
    } else if (rarity === "epic") {
      this.state.player.gacha.pityEpic = 0;
      this.state.player.gacha.pityLegendary += 1;
    } else {
      this.state.player.gacha.pityEpic = pityEpic;
      this.state.player.gacha.pityLegendary = pityLegendary;
    }
    return rarity;
  }
}

export type { EngineState } from "./types.js";
