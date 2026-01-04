import { Reward } from "../types.js";

export type NodeType = "normal" | "elite" | "boss" | "treasure";

export interface RewardBundle {
  gold: number;
  exp: number;
  items?: { id: string; qty: number }[];
}

export interface CampaignNode {
  id: string;
  chapterIndex: number;
  index: number;
  type: NodeType;
  recommendedPower: number;
  rewards: RewardBundle;
  edges: string[];
}

export interface CampaignChapter {
  id: string;
  index: number;
  nodes: CampaignNode[];
}

export interface CampaignGraph {
  seed: number;
  chapters: CampaignChapter[];
  startNodeId: string;
}
