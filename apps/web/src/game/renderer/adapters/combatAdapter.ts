import {
  generateCampaignGraph,
  simulateCombatTimeline,
  type AfkHero,
  type AfkUpgrade,
  type AfkStage,
  type CampaignGraph,
  type CampaignNode,
} from "@ai-studio/core";

import { loadProgress, loadRoster } from "@/lib/afk/storage";
import { CombatEvent, CombatReplay, CombatSnapshot, CombatUnitSnapshot } from "../types/combat";

const GRAPH_SEED_DEFAULT = 12345;
const CHAPTERS = 8;
const NODES_PER_CHAPTER = 10;
const BASE_TICK_MS = 620;

// Data source: simulateCombatTimeline from packages/core/afk/engineAdapter.ts (events + frames).
// Limitation: engine emits aggregate attack/heal/death events; crit flag is used to derive a separate crit event for the renderer.

function parseQueryParam(name: string): string | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const value = params.get(name);
  return value;
}

function stageFromNode(node: CampaignNode): AfkStage {
  const materials =
    node.rewards.items?.reduce((acc, item) => acc + item.qty, 0) ??
    Math.max(1, Math.round(node.recommendedPower * 0.012));
  return {
    id: node.id,
    chapter: node.chapterIndex + 1,
    index: node.index,
    recommendedPower: node.recommendedPower,
    enemyPower: Math.max(120, Math.round(node.recommendedPower * 0.95)),
    reward: { gold: node.rewards.gold, exp: node.rewards.exp, materials },
    unlocked: true,
  };
}

function findNode(graph: CampaignGraph, nodeId?: string | null) {
  if (!nodeId) return graph.chapters[0]?.nodes[0] ?? null;
  for (const chapter of graph.chapters) {
    const found = chapter.nodes.find((n) => n.id === nodeId);
    if (found) return found;
  }
  return graph.chapters[0]?.nodes[0] ?? null;
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

export async function getCombatReplay(): Promise<CombatReplay | null> {
  const roster = loadRoster();
  const progress = loadProgress();

  const seedParam = parseQueryParam("seed");
  const nodeParam = parseQueryParam("nodeId");
  const graphSeed = Number.isFinite(Number(seedParam)) ? Number(seedParam) : GRAPH_SEED_DEFAULT;
  const graph = generateCampaignGraph({ seed: graphSeed, chaptersCount: CHAPTERS, nodesPerChapter: NODES_PER_CHAPTER });
  const node = findNode(graph, nodeParam ?? progress?.currentNodeId ?? graph.startNodeId);
  if (!node) return null;

  const stage = stageFromNode(node);
  const stageLabel = `${stage.chapter}-${stage.index + 1}`;

  const heroes = pickAllies(roster);
  const upgrades: AfkUpgrade[] = [];

  const timeline = simulateCombatTimeline(heroes, stage, upgrades, { tickMs: BASE_TICK_MS }, `${graphSeed}-${node.id}`);
  const snapshot = snapshotFromTimeline(timeline, stageLabel);
  if (!snapshot) return null;

  const events = eventsFromTimeline(timeline);

  return {
    snapshot,
    events,
  };
}
