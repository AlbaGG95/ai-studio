import { generateCampaignGraph, type CampaignGraph } from "@ai-studio/core";

import { loadProgress } from "@/lib/afk/storage";

type MapNode = { id: string; x: number; y: number; power?: number };

type CampaignProgress = {
  chapterLabel: string;
  currentStageId: string;
  completedStageIds: string[];
  nodes: MapNode[];
};

const GRAPH_SEED = 12345;
const CHAPTERS = 8;
const NODES_PER_CHAPTER = 10;

type Point = { x: number; y: number };

function buildPositions(graph: CampaignGraph) {
  const coords: Record<string, Point> = {};
  const stages = graph.chapters.flatMap((chapter) => chapter.nodes);
  stages.forEach((stage, index) => {
    const col = index % 5;
    const row = Math.floor(index / 5);
    const baseX = 120 + col * 200 + (row % 2 === 0 ? 20 : -20);
    const baseY = 120 + row * 120;
    coords[stage.id] = { x: baseX, y: baseY };
  });
  return coords;
}

function flattenNodes(graph: CampaignGraph) {
  return graph.chapters
    .flatMap((chapter) => chapter.nodes.map((node) => ({ ...node, chapterIndex: chapter.index })))
    .sort((a, b) => (a.chapterIndex === b.chapterIndex ? a.index - b.index : a.chapterIndex - b.chapterIndex));
}

export async function getCampaignProgress(): Promise<CampaignProgress | null> {
  const graph = generateCampaignGraph({ seed: GRAPH_SEED, chaptersCount: CHAPTERS, nodesPerChapter: NODES_PER_CHAPTER });
  const positions = buildPositions(graph);
  const flatNodes = flattenNodes(graph);

  const progress = loadProgress();
  const currentStageId = progress?.currentNodeId || graph.startNodeId;
  const completedStageIds = progress?.cleared ? Object.keys(progress.cleared) : [];

  const currentNode = flatNodes.find((node) => node.id === currentStageId) ?? flatNodes[0];
  const chapterLabel = currentNode ? `Chapter ${currentNode.chapterIndex + 1}` : "Chapter 1";

  const nodes: MapNode[] = flatNodes.map((node) => {
    const pos = positions[node.id] ?? { x: 0, y: 0 };
    return { id: node.id, x: pos.x, y: pos.y, power: node.recommendedPower };
  });

  return {
    chapterLabel,
    currentStageId,
    completedStageIds,
    nodes,
  };
}
