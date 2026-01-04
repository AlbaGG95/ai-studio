import { createAfkPlayer, type AfkHero, type AfkPlayerState } from "@ai-studio/core";

export type ProgressState = { currentNodeId: string; cleared: Record<string, true> };
export type PlayerRoster = { heroes: AfkHero[]; team: string[] };

const PROGRESS_KEY = "afk_progress_v1";
const ROSTER_KEY = "afk-state-v2";

function parseJson<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function baseRoster(): PlayerRoster {
  const base = createAfkPlayer(Date.now());
  const heroes = base.heroes ?? [];
  const team = (base as any).activeHeroIds && Array.isArray((base as any).activeHeroIds) && (base as any).activeHeroIds.length
    ? (base as any).activeHeroIds
    : heroes.slice(0, 5).map((h) => h.id);
  return { heroes, team };
}

export function loadRoster(): PlayerRoster {
  if (typeof window === "undefined") return baseRoster();
  const parsed = parseJson<Partial<AfkPlayerState>>(window.localStorage.getItem(ROSTER_KEY));
  if (!parsed) return baseRoster();
  const heroes = Array.isArray(parsed.heroes) && parsed.heroes.length ? (parsed.heroes as AfkHero[]) : baseRoster().heroes;
  const team =
    Array.isArray((parsed as any).activeHeroIds) && (parsed as any).activeHeroIds.length
      ? (parsed as any).activeHeroIds
      : heroes.slice(0, 5).map((h) => h.id);
  return { heroes, team };
}

export function saveRoster(roster: PlayerRoster) {
  if (typeof window === "undefined") return;
  const existing = parseJson<Partial<AfkPlayerState>>(window.localStorage.getItem(ROSTER_KEY)) ?? {};
  const next: Partial<AfkPlayerState> = {
    ...existing,
    heroes: roster.heroes,
    activeHeroIds: roster.team,
  };
  try {
    window.localStorage.setItem(ROSTER_KEY, JSON.stringify(next));
  } catch {
    // ignore persistence errors
  }
}

export function loadProgress(): ProgressState | null {
  if (typeof window === "undefined") return null;
  const parsed = parseJson<ProgressState>(window.localStorage.getItem(PROGRESS_KEY));
  if (!parsed || typeof parsed !== "object") return null;
  const currentNodeId = typeof parsed.currentNodeId === "string" ? parsed.currentNodeId : "";
  const cleared = parsed.cleared && typeof parsed.cleared === "object" ? parsed.cleared : {};
  return { currentNodeId: currentNodeId || "", cleared };
}

export function saveProgress(state: ProgressState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PROGRESS_KEY, JSON.stringify(state));
  } catch {
    // ignore persistence errors
  }
}
