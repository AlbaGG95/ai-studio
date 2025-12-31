'use client';

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AfkPlayerState,
  AfkReward,
  AfkUpgrade,
  AfkCombatSummary,
  AfkIdleTickResult,
  AfkTickContext,
  advanceAfkStage,
  applyAfkOfflineProgress,
  applyAfkStageReward,
  handleAfkMilestones,
  computeAfkTickIncome,
  createAfkPlayer,
  runAfkTicks,
  simulateAfkCombat,
} from "@ai-studio/core";
import { GameConfig } from "@/config/gameConfigs";

const STORAGE_KEY = "afk-state-v1";
const TICK_MS = 1000;
const PROGRESS_PER_TICK = 0.2;
const OFFLINE_CAP_HOURS = 4;

type ToastTone = "success" | "info" | "warn";

export type AfkView = "home" | "heroes" | "battle" | "upgrades" | "settings";

export interface AfkToast {
  id: number;
  text: string;
  tone: ToastTone;
}

export interface AfkEvent {
  id: number;
  text: string;
}

export interface AfkStore {
  player: AfkPlayerState | null;
  loading: boolean;
  idlePerMinute: AfkReward;
  banked: AfkReward;
  lastCombat: AfkCombatSummary | null;
  events: AfkEvent[];
  toasts: AfkToast[];
  claimBank: () => void;
  startBattle: () => void;
  upgradeHero: (heroId: string) => void;
  buyUpgrade: (upgradeId: string) => void;
  recruitHero: () => void;
  loadDemoState: () => void;
  exportState: () => string;
  importState: (payload: string) => void;
  resetState: () => void;
}

const emptyReward: AfkReward = { gold: 0, essence: 0 };

function baseTickReward(state: AfkPlayerState, config: GameConfig): AfkReward {
  const stageReward = state.stage.reward;
  const gold = Math.max(config.balance.baseGoldPerTick, Math.round(stageReward.gold * 0.15 * config.balance.rewardMultiplier));
  const essence = Math.max(config.balance.baseEssencePerTick, Math.round(stageReward.essence * 0.25 * config.balance.rewardMultiplier));
  return { gold, essence };
}

export function useAfkGame(config: GameConfig): AfkStore {
  const [player, setPlayer] = useState<AfkPlayerState | null>(null);
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<AfkEvent[]>([]);
  const [toasts, setToasts] = useState<AfkToast[]>([]);
  const [lastCombat, setLastCombat] = useState<AfkCombatSummary | null>(null);
  const stateRef = useRef<AfkPlayerState | null>(null);
  const toastId = useRef(0);
  const eventId = useRef(0);

  const tickCtx: AfkTickContext = useMemo(
    () => ({ now: Date.now(), tickMs: TICK_MS, offlineCapHours: OFFLINE_CAP_HOURS, progressPerTick: PROGRESS_PER_TICK }),
    []
  );

  useEffect(() => {
    const saved = loadState();
    const now = Date.now();
    let initial = saved ? applyConfigToState(saved, config) : applyConfigToState(createAfkPlayer(now), config);
    if (saved) {
      const synced = applyAfkOfflineProgress(initial, now, {
        tickMs: TICK_MS,
        offlineCapHours: OFFLINE_CAP_HOURS,
        progressPerTick: PROGRESS_PER_TICK,
      });
      initial = applyConfigToState(synced.state, config);
      if (synced.ticks > 0) {
        addToast("Se aplicaron recompensas offline", "info");
        recordEvent(`Offline: +${synced.ticks} ticks aplicados`);
      }
    }
    stateRef.current = { ...initial, lastTickAt: now };
    setPlayer(stateRef.current);
    setLoading(false);
  }, [config]);

  useEffect(() => {
    if (!player) return;
    stateRef.current = player;
    persistState(player);
  }, [player]);

  useEffect(() => {
    if (!player) return;
    const timer = setInterval(() => {
      const current = stateRef.current;
      if (!current) return;
      const reward = baseTickReward(current, config);
      const result = runAfkTicks(current, { ...tickCtx, now: Date.now() }, reward);
      handleTickResult(result);
    }, TICK_MS);
    return () => clearInterval(timer);
  }, [player, tickCtx, config]);

  const addToast = (text: string, tone: ToastTone = "info") => {
    const id = ++toastId.current;
    setToasts((prev) => [...prev, { id, text, tone }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4200);
  };

  const recordEvent = (text: string) => {
    const id = ++eventId.current;
    setEvents((prev) => [{ id, text }, ...prev].slice(0, 12));
  };

  const handleTickResult = (result: AfkIdleTickResult) => {
    const next = { ...result.state };
    stateRef.current = next;
    setPlayer(next);
    if (result.stageCleared) {
      recordEvent(`Stage ${result.state.stage.index - 1} completado`);
      addToast("Stage completado", "success");
    }
    if (result.combat) {
      setLastCombat(result.combat);
    }
  };

  const claimBank = () => {
    setPlayer((current) => {
      if (!current) return current;
      const next = structuredClone(current);
      next.resources.gold += current.afkBank.gold;
      next.resources.essence += current.afkBank.essence;
      next.afkBank = { ...emptyReward };
      addToast("Recompensas AFK cobradas", "success");
      recordEvent("AFK cobrado");
      return next;
    });
  };

  const startBattle = () => {
    const current = stateRef.current;
    if (!current) return;
    const heroes = current.heroes.filter((hero) => current.activeHeroIds.includes(hero.id));
    if (!heroes.length) {
      addToast("No hay héroes activos", "warn");
      return;
    }
    const combat = simulateAfkCombat(heroes, current.stage, current.upgrades);
    setLastCombat(combat);
    let next = structuredClone(current);
    if (combat.result === "win") {
      next = applyAfkStageReward(next, next.stage.reward);
      next.stage = advanceAfkStage(next.stage);
      next = handleAfkMilestones(next);
      recordEvent(`Victoria en stage ${current.stage.index}`);
      addToast("Victoria", "success");
    } else {
      next.stage.progress = 0;
      recordEvent(`Derrota en stage ${current.stage.index}`);
      addToast("Derrota", "warn");
    }
    next.lastTickAt = Date.now();
    stateRef.current = next;
    setPlayer(next);
  };

  const upgradeHero = (heroId: string) => {
    setPlayer((current) => {
      if (!current) return current;
      const next = structuredClone(current);
      const hero = next.heroes.find((h) => h.id === heroId);
      if (!hero) return current;
      const costGold = Math.max(5, hero.level * 10);
      const costEssence = Math.max(0, hero.level * 2);
      if (next.resources.gold < costGold || next.resources.essence < costEssence) {
        addToast("Recursos insuficientes", "warn");
        return current;
      }
      next.resources.gold -= costGold;
      next.resources.essence -= costEssence;
      hero.level += 1;
      hero.power += 5;
      recordEvent(`Heroe ${hero.name} sube a nivel ${hero.level}`);
      addToast(`${hero.name} mejorado`, "success");
      return next;
    });
  };

  const buyUpgrade = (upgradeId: string) => {
    setPlayer((current) => {
      if (!current) return current;
      const next = structuredClone(current);
      const target = next.upgrades.find((u) => u.id === upgradeId);
      if (!target) return current;
      const cost = {
        gold: target.cost.gold * (target.level + 1),
        essence: (target.cost.essence ?? 0) * (target.level + 1),
      };
      if (next.resources.gold < cost.gold || next.resources.essence < cost.essence) {
        addToast("No alcanza el oro/esencia", "warn");
        return current;
      }
      if (target.cap && target.level >= target.cap) {
        addToast("Upgrade al máximo", "info");
        return current;
      }
      next.resources.gold -= cost.gold;
      next.resources.essence -= cost.essence;
      target.level += 1;
      target.unlocked = true;
      recordEvent(`Upgrade ${target.name} -> nivel ${target.level}`);
      addToast(`${target.name} mejorado`, "success");
      return next;
    });
  };

  const recruitHero = () => {
    setPlayer((current) => {
      const next = current ? structuredClone(current) : applyConfigToState(createAfkPlayer(Date.now()), config);
      const template = config.contentData.heroes[next.heroes.length % config.contentData.heroes.length] ?? {
        name: `Hero ${next.heroes.length + 1}`,
        role: "fighter",
        rarity: "common",
        power: 12,
        level: 1,
      };
      const id = `hero-${next.heroes.length + 1}`;
      next.heroes.push({
        id,
        name: template.name,
        level: template.level,
        power: template.power,
        role: template.role,
        rarity: template.rarity,
      });
      next.activeHeroIds.push(id);
      recordEvent("Nuevo héroe reclutado");
      addToast("Heroe reclutado", "success");
      return next;
    });
  };

  const loadDemoState = () => {
    const demo = createDemoState(config);
    stateRef.current = demo;
    setPlayer(demo);
    recordEvent("Demo mode activado");
    addToast("Demo listo", "info");
  };

  const exportState = (): string => {
    if (!player) return "";
    return JSON.stringify(player, null, 2);
  };

  const importState = (payload: string) => {
    try {
      const parsed = JSON.parse(payload) as AfkPlayerState;
      parsed.lastTickAt = Date.now();
      const hydrated = applyConfigToState(parsed, config);
      stateRef.current = hydrated;
      setPlayer(hydrated);
      addToast("Estado importado", "success");
      recordEvent("Import manual");
    } catch {
      addToast("JSON inválido", "warn");
    }
  };

  const resetState = () => {
    const fresh = applyConfigToState(createAfkPlayer(Date.now()), config);
    stateRef.current = fresh;
    setPlayer(fresh);
    recordEvent("Estado reiniciado");
    addToast("Reset aplicado", "info");
  };

  const idlePerMinute = useMemo(() => {
    if (!player) return emptyReward;
    const base = baseTickReward(player, config);
    const perTick = computeAfkTickIncome(player, base);
    const factor = (60 * 1000) / TICK_MS;
    return {
      gold: Math.round(perTick.gold * factor),
      essence: Math.round(perTick.essence * factor),
    };
  }, [player, config]);

  const banked = useMemo(() => player?.afkBank ?? emptyReward, [player]);

  return {
    player,
    loading,
    idlePerMinute,
    banked,
    lastCombat,
    events,
    toasts,
    claimBank,
    startBattle,
    upgradeHero,
    buyUpgrade,
    recruitHero,
    loadDemoState,
    exportState,
    importState,
    resetState,
  };
}

function loadState(): AfkPlayerState | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AfkPlayerState;
  } catch {
    return null;
  }
}

function persistState(state: AfkPlayerState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function createDemoState(config: GameConfig): AfkPlayerState {
  const now = Date.now();
  let base = applyConfigToState(createAfkPlayer(now), config);
  base.resources = { gold: 500, essence: 120 };
  base.stage = {
    id: "stage-1",
    index: 1,
    enemyPower: config.contentData.stage.enemyPower,
    reward: config.contentData.stage.reward,
    progress: 0.4,
    milestone: true,
  };
  base.heroes = config.contentData.heroes.map((hero, idx) => ({
    id: `demo-${idx + 1}`,
    name: hero.name,
    level: hero.level,
    power: hero.power,
    role: hero.role,
    rarity: hero.rarity,
  }));
  base.activeHeroIds = base.heroes.map((h) => h.id);
  base.upgrades = base.upgrades.map((upg, idx) => ({
    ...upg,
    name: config.contentData.upgrades[idx]?.name ?? upg.name,
  }));
  base.unlocks = { home: true, heroes: true, upgrades: true, settings: true };
  base.afkBank = { gold: 50, essence: 10 };
  base.lastTickAt = now;
  return base;
}

function applyConfigToState(state: AfkPlayerState, config: GameConfig): AfkPlayerState {
  const next = structuredClone(state);
  const heroes = config.contentData.heroes;
  next.heroes = next.heroes.map((hero, idx) => {
    const template = heroes[idx % heroes.length];
    return {
      ...hero,
      name: template?.name ?? hero.name,
      role: template?.role ?? hero.role,
      rarity: template?.rarity ?? hero.rarity,
      power: template?.power ?? hero.power,
      level: template?.level ?? hero.level,
    };
  });
  if (next.stage.index <= 1) {
    next.stage = {
      ...next.stage,
      enemyPower: config.contentData.stage.enemyPower,
      reward: config.contentData.stage.reward,
    };
  }
  next.upgrades = next.upgrades.map((upg, idx) => ({
    ...upg,
    name: config.contentData.upgrades[idx]?.name ?? upg.name,
  }));
  return next;
}
