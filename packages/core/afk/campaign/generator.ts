import { makeRng, hashString } from "../seed.js";
import { Reward } from "../types.js";
import { CampaignGraph, CampaignChapter, CampaignNode, NodeType, RewardBundle } from "./types.js";

type GenerateOptions = {
  seed: number;
  chaptersCount?: number;
  nodesPerChapter?: number;
};

const TYPE_WEIGHTS: Array<{ type: NodeType; weight: number }> = [
  { type: "normal", weight: 0.7 },
  { type: "elite", weight: 0.2 },
  { type: "treasure", weight: 0.1 },
];

function pickType(rng: () => number): NodeType {
  const roll = rng();
  let acc = 0;
  for (const entry of TYPE_WEIGHTS) {
    acc += entry.weight;
    if (roll <= acc) return entry.type;
  }
  return "normal";
}

function typeMultiplier(type: NodeType) {
  switch (type) {
    case "boss":
      return 1.8;
    case "elite":
      return 1.3;
    case "treasure":
      return 1.05;
    default:
      return 1;
  }
}

function buildRewards(power: number, type: NodeType, rng: () => number): RewardBundle {
  const gold = Math.round(power * (0.5 + rng() * 0.25) * (type === "treasure" ? 1.25 : 1));
  const exp = Math.round(power * (0.45 + rng() * 0.2) * (type === "boss" ? 1.3 : 1));
  const bundle: RewardBundle = { gold, exp };
  if (type === "treasure" || type === "boss") {
    const itemCount = type === "boss" ? 2 : 1;
    bundle.items = [];
    for (let i = 0; i < itemCount; i += 1) {
      bundle.items.push({
        id: `item-${hashString(`itm-${power}-${i}-${gold}-${exp}`) % 9999}`,
        qty: 1 + Math.floor(rng() * 2),
      });
    }
  }
  return bundle;
}

function buildNodeId(chapterIndex: number, nodeIndex: number, isBoss: boolean) {
  return isBoss ? `c${chapterIndex}_boss` : `c${chapterIndex}_n${nodeIndex}`;
}

function connectNodes(nodes: CampaignNode[], rng: () => number) {
  const lastIdx = nodes.length - 1;
  for (let i = 0; i < nodes.length; i += 1) {
    if (i === lastIdx) {
      nodes[i].edges = [];
      continue;
    }
    const edges = new Set<string>();
    edges.add(nodes[i + 1].id);
    if (i + 2 <= lastIdx && rng() > 0.7) {
      edges.add(nodes[i + 2].id);
    }
    nodes[i].edges = Array.from(edges);
  }
}

function buildChapter(seed: number, chapterIndex: number, nodesPerChapter: number): CampaignChapter {
  const rng = makeRng(`${seed}-c${chapterIndex}`);
  const nodes: CampaignNode[] = [];
  const count = Math.max(3, nodesPerChapter);
  const basePower = 140 + chapterIndex * 120;

  for (let i = 0; i < count; i += 1) {
    const isBoss = i === count - 1;
    const type: NodeType = isBoss ? "boss" : pickType(rng);
    const id = buildNodeId(chapterIndex, i, isBoss);
    const power = Math.round(basePower * (1 + i * 0.12) * typeMultiplier(type));
    const rewards = buildRewards(power, type, rng);
    nodes.push({
      id,
      chapterIndex,
      index: i,
      type,
      recommendedPower: power,
      rewards,
      edges: [],
    });
  }

  connectNodes(nodes, rng);

  return {
    id: `chapter-${chapterIndex}`,
    index: chapterIndex,
    nodes,
  };
}

export function generateCampaignGraph(options: GenerateOptions): CampaignGraph {
  const seed = options.seed;
  const chaptersCount = options.chaptersCount ?? 10;
  const nodesPerChapter = options.nodesPerChapter ?? 10;
  const chapters: CampaignChapter[] = [];

  for (let c = 0; c < chaptersCount; c += 1) {
    chapters.push(buildChapter(seed, c, nodesPerChapter));
  }

  const startNodeId = chapters[0]?.nodes[0]?.id ?? "c0_n0";

  return {
    seed,
    chapters,
    startNodeId,
  };
}
