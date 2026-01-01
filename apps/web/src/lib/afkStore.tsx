'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  AFK_STAGES,
  applyAfkOfflineProgress,
  applyAfkVictory,
  buildAfkHeroVisual,
  computeAfkIdleRate,
  createAfkPlayer,
  levelUpAfkHero,
  afkLevelUpCost,
  runAfkTicks,
  setAfkStage,
  simulateAfkCombat,
  type AfkBattleUnit,
  type AfkCombatSummary,
  type AfkHero,
  type AfkHeroVisual,
  type AfkPlayerState,
  type AfkReward,
  type AfkStage,
} from "@ai-studio/core";

const STORAGE_KEY = "afk-state-v2";
const TICK_MS = 1000;
const OFFLINE_CAP_HOURS = 8;

type AfkContextValue = {
  state: AfkPlayerState | null;
  stages: AfkStage[];
  loading: boolean;
  bank: AfkReward;
  heroVisuals: Record<string, AfkHeroVisual>;
  setCurrentStage: (stageId: string) => void;
  claimIdle: () => void;
  levelUpHero: (heroId: string) => boolean;
  startBattle: (stageId?: string) => BattleSession | null;
  completeBattle: (stageId: string, summary: AfkCombatSummary) => void;
  toggleActive: (heroId: string) => void;
  reset: () => void;
};

export type BattleSession = {
  stage: AfkStage;
  summary: AfkCombatSummary;
  allies: AfkBattleUnit[];
  enemies: AfkBattleUnit[];
};

const AfkContext = createContext<AfkContextValue | null>(null);

function stageById(stageId: string): AfkStage {
  return AFK_STAGES.find((s) => s.id === stageId) ?? AFK_STAGES[0];
}

function recalcIdleRate(state: AfkPlayerState): AfkPlayerState {
  const stage = stageById(state.campaign.currentStageId);
  const idleUpgrade = state.upgrades.find((u) => u.id === "idle-rate");
  const boost = idleUpgrade ? (idleUpgrade.effect.idleBoost ?? 0) * (idleUpgrade.level + 1) : 0;
  const rate = computeAfkIdleRate(stage, boost, state.heroes);
  return { ...state, idle: { ...state.idle, ratePerMinute: rate } };
}

function normalizeState(raw: Partial<AfkPlayerState> | null, now: number): AfkPlayerState {
  const base = createAfkPlayer(now);
  if (!raw) return base;
  const merged: AfkPlayerState = {
    ...base,
    ...raw,
    resources: { ...base.resources, ...(raw.resources ?? {}) },
    heroes: (raw.heroes ?? base.heroes).map((hero, idx) => ({
      ...base.heroes[idx % base.heroes.length],
      ...hero,
      stats: { ...(base.heroes[idx % base.heroes.length].stats), ...(hero.stats ?? {}) },
      visualSeed: hero.visualSeed ?? base.heroes[idx % base.heroes.length].visualSeed,
    })),
    activeHeroIds:
      raw.activeHeroIds && raw.activeHeroIds.length
        ? raw.activeHeroIds
        : (raw.heroes ?? base.heroes).slice(0, 5).map((h) => h.id),
    campaign: {
      ...base.campaign,
      ...(raw.campaign ?? {}),
      unlockedStageIds: raw.campaign?.unlockedStageIds?.length
        ? raw.campaign.unlockedStageIds
        : base.campaign.unlockedStageIds,
      completedStageIds: raw.campaign?.completedStageIds ?? [],
    },
    upgrades: raw.upgrades ?? base.upgrades,
    idle: {
      ...base.idle,
      ...(raw.idle ?? {}),
      bank: { ...base.idle.bank, ...(raw.idle?.bank ?? {}) },
      lastSeenAt: raw.idle?.lastSeenAt ?? now,
      lastClaimAt: raw.idle?.lastClaimAt ?? now,
    },
  };
  return recalcIdleRate(merged);
}

export function AfkProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AfkPlayerState | null>(null);
  const [loading, setLoading] = useState(true);
  const stateRef = useRef<AfkPlayerState | null>(null);

  const commit = useCallback((next: AfkPlayerState) => {
    stateRef.current = next;
    setState(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    }
  }, []);

  useEffect(() => {
    const now = Date.now();
    const saved = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
    const parsed = saved ? (JSON.parse(saved) as Partial<AfkPlayerState>) : null;
    const base = normalizeState(parsed, now);
    const offline = applyAfkOfflineProgress(base, now, {
      tickMs: TICK_MS,
      offlineCapHours: OFFLINE_CAP_HOURS,
    });
    const hydrated = recalcIdleRate({ ...offline.state, idle: { ...offline.state.idle, lastSeenAt: now } });
    stateRef.current = hydrated;
    setState(hydrated);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!state) return;
    const timer = setInterval(() => {
      const current = stateRef.current;
      if (!current) return;
      const result = runAfkTicks(current, {
        now: Date.now(),
        tickMs: TICK_MS,
        offlineCapHours: OFFLINE_CAP_HOURS,
      });
      if (result.ticks > 0) {
        commit(recalcIdleRate({ ...result.state, idle: { ...result.state.idle, lastSeenAt: Date.now() } }));
      }
    }, TICK_MS);
    return () => clearInterval(timer);
  }, [state, commit]);

  const claimIdle = useCallback(() => {
    if (!stateRef.current) return;
    const current = stateRef.current;
    const next: AfkPlayerState = {
      ...current,
      resources: {
        gold: Math.round(current.resources.gold + current.idle.bank.gold),
        exp: Math.round(current.resources.exp + current.idle.bank.exp),
        materials: Math.round(current.resources.materials + current.idle.bank.materials),
      },
      idle: {
        ...current.idle,
        bank: { gold: 0, exp: 0, materials: 0 },
        lastClaimAt: Date.now(),
        lastSeenAt: Date.now(),
      },
    };
    commit(recalcIdleRate(next));
  }, [commit]);

  const setCurrentStage = useCallback(
    (stageId: string) => {
      if (!stateRef.current) return;
      if (!stateRef.current.campaign.unlockedStageIds.includes(stageId)) return;
      const stage = stageById(stageId);
      const next = recalcIdleRate(setAfkStage(stateRef.current, stage.id));
      commit(next);
    },
    [commit]
  );

  const levelUpHero = useCallback(
    (heroId: string) => {
      if (!stateRef.current) return false;
      const next = levelUpAfkHero(stateRef.current, heroId);
      if (next === stateRef.current) return false;
      commit(recalcIdleRate(next));
      return true;
    },
    [commit]
  );

  const toggleActive = useCallback(
    (heroId: string) => {
      if (!stateRef.current) return;
      const current = stateRef.current;
      const active = new Set(current.activeHeroIds);
      if (active.has(heroId)) {
        active.delete(heroId);
      } else if (active.size < 5) {
        active.add(heroId);
      }
      commit({ ...current, activeHeroIds: Array.from(active) });
    },
    [commit]
  );

  const startBattle = useCallback(
    (stageId?: string): BattleSession | null => {
      const current = stateRef.current;
      if (!current) return null;
      const stage = stageById(stageId ?? current.campaign.currentStageId);
      if (!current.campaign.unlockedStageIds.includes(stage.id)) return null;
      const heroes = current.heroes.filter((h) => current.activeHeroIds.includes(h.id)).slice(0, 5);
      if (!heroes.length) return null;
      const summary = simulateAfkCombat(heroes, stage, current.upgrades, { tickMs: 520 });
      return {
        stage,
        summary,
        allies: summary.allies ?? [],
        enemies: summary.enemies ?? [],
      };
    },
    []
  );

  const completeBattle = useCallback(
    (stageId: string, summary: AfkCombatSummary) => {
      if (!stateRef.current) return;
      const current = stateRef.current;
      const stage = stageById(stageId);
      let next = { ...current, idle: { ...current.idle, lastSeenAt: Date.now() } };
      if (summary.result === "win") {
        next = applyAfkVictory(next, stage);
      }
      commit(recalcIdleRate(next));
    },
    [commit]
  );

  const reset = useCallback(() => {
    const now = Date.now();
    const next = recalcIdleRate(createAfkPlayer(now));
    commit(next);
  }, [commit]);

  const heroVisuals = useMemo(() => {
    const visuals: Record<string, AfkHeroVisual> = {};
    state?.heroes.forEach((hero: AfkHero) => {
      visuals[hero.id] = buildAfkHeroVisual(hero.visualSeed);
    });
    return visuals;
  }, [state]);

  const bank = state?.idle.bank ?? { gold: 0, exp: 0, materials: 0 };

  const value: AfkContextValue = {
    state,
    stages: AFK_STAGES,
    loading,
    bank,
    heroVisuals,
    setCurrentStage,
    claimIdle,
    levelUpHero,
    startBattle,
    completeBattle,
    toggleActive,
    reset,
  };

  return <AfkContext.Provider value={value}>{children}</AfkContext.Provider>;
}

export function useAfk() {
  const ctx = useContext(AfkContext);
  if (!ctx) {
    throw new Error("useAfk must be used inside AfkProvider");
  }
  return ctx;
}

export function levelUpCostLabel(hero: AfkHero): AfkReward {
  return afkLevelUpCost(hero);
}
