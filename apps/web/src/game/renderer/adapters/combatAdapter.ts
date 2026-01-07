import { AFK_STAGES, simulateCombatTimeline, type AfkHero, type AfkUpgrade, type AfkStage } from "@ai-studio/core";

import { loadRoster } from "@/lib/afk/storage";
import { getCurrentStageId, loadCampaignViewModelFromStorage } from "../../campaign/campaignViewModel";
import { CombatEvent, CombatReplay, CombatSnapshot, CombatUnitSnapshot } from "../types/combat";

const BASE_TICK_MS = 620;

// Data source: simulateCombatTimeline from packages/core/afk/engineAdapter.ts (events + frames).
// Limitation: engine emits aggregate attack/heal/death events; crit flag is used to derive a separate crit event for the renderer.

function parseQueryParam(name: string): string | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const value = params.get(name);
  return value;
}

function pickAllies(roster: { heroes: AfkHero[]; team: string[] }) {
  const heroes = roster.heroes ?? [];
  const teamIds = roster.team && roster.team.length ? roster.team : heroes.slice(0, 5).map((h) => h.id);
  const selected: AfkHero[] = [];
  for (const id of teamIds) {
    const hero = heroes.find((h) => h.id === id);
    if (hero) selected.push(hero);
    if (selected.length >= 5) break;
  }
  if (selected.length < 5) {
    const padding = heroes.filter((h) => !teamIds.includes(h.id)).slice(0, 5 - selected.length);
    selected.push(...padding);
  }
  return selected.slice(0, 5);
}

function snapshotFromTimeline(timeline: ReturnType<typeof simulateCombatTimeline>, stageLabel: string): CombatSnapshot | null {
  const initial = timeline.frames[0];
  if (!initial) return null;
  const units: CombatUnitSnapshot[] = [];
  initial.allies.forEach((unit, idx) => {
    units.push({
      id: unit.heroId,
      name: unit.name,
      team: "ally",
      hp: unit.hp,
      maxHp: unit.maxHp,
      slotIndex: idx,
    });
  });
  initial.enemies.forEach((unit, idx) => {
    units.push({
      id: unit.heroId,
      name: unit.name,
      team: "enemy",
      hp: unit.hp,
      maxHp: unit.maxHp,
      slotIndex: idx,
    });
  });
  return { stageLabel, units };
}

function eventsFromTimeline(timeline: ReturnType<typeof simulateCombatTimeline>): CombatEvent[] {
  const events: CombatEvent[] = [];
  let order = 1;

  for (let i = 1; i < timeline.frames.length; i += 1) {
    const frame = timeline.frames[i];
    for (const evt of frame.events) {
      const targetId = evt.targetId ?? evt.sourceId ?? "";
      if (!evt.sourceId && !targetId) continue;
      if (evt.kind === "attack" || evt.kind === "ultimate") {
        events.push({
          type: "attack",
          sourceId: evt.sourceId,
          targetId,
          skillId: evt.kind === "ultimate" ? "ultimate" : undefined,
          order: order++,
        });
        events.push({
          type: evt.crit ? "crit" : "hit",
          sourceId: evt.sourceId,
          targetId,
          value: Math.max(0, evt.amount),
          order: order++,
        });
      } else if (evt.kind === "heal") {
        events.push({
          type: "heal",
          sourceId: evt.sourceId,
          targetId,
          value: Math.max(0, evt.amount),
          order: order++,
        });
      } else if (evt.kind === "death") {
        events.push({
          type: "death",
          targetId,
          order: order++,
        });
      }
    }
  }

  const result = timeline.summary.result === "win" ? "victory" : "defeat";
  events.push({ type: "stage_end", result, order: order++ });

  return events;
}

function resolveStage(stageId: string | null | undefined): AfkStage {
  const found = AFK_STAGES.find((stage) => stage.id === stageId);
  return found ?? AFK_STAGES[0];
}

export async function getCombatReplay(options: { stageId?: string } = {}): Promise<CombatReplay | null> {
  const roster = loadRoster();
  const vm = loadCampaignViewModelFromStorage();
  const completed = new Set(vm?.stages.filter((s) => s.state === "completed").map((s) => s.id));
  const paramStage = options.stageId ?? parseQueryParam("stageId");
  const currentStageId = paramStage && AFK_STAGES.some((s) => s.id === paramStage) ? paramStage : getCurrentStageId(AFK_STAGES, completed);
  const stage = resolveStage(currentStageId);
  const stageLabel = stage.id;

  const heroes = pickAllies(roster);
  const upgrades: AfkUpgrade[] = [];

  const timeline = simulateCombatTimeline(heroes, stage, upgrades, { tickMs: BASE_TICK_MS }, stage.id);
  const snapshot = snapshotFromTimeline(timeline, stageLabel);
  if (!snapshot) return null;

  const events = eventsFromTimeline(timeline);

  return {
    snapshot,
    events,
  };
}
