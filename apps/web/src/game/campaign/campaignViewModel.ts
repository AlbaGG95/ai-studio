'use client';

import { AFK_STAGES, type AfkPlayerState, type AfkStage, type AfkReward } from "@ai-studio/core";

import { normalizeAfkState } from "@/lib/afkStore";

export type CampaignStageView = {
  id: string;
  chapter: number;
  index: number;
  recommendedPower: number;
  reward: AfkReward;
  state: "locked" | "ready" | "completed";
};

export type CampaignViewModel = {
  chapterLabel: string;
  currentStageId: string;
  stages: CampaignStageView[];
};

function fallbackStageId(stages: AfkStage[]): string {
  return stages[0]?.id ?? "1-1";
}

function deriveStageState(stageId: string, unlocked: Set<string>, completed: Set<string>): CampaignStageView["state"] {
  if (completed.has(stageId)) return "completed";
  if (unlocked.has(stageId)) return "ready";
  return "locked";
}

export function buildCampaignViewModel(state: AfkPlayerState | null, stages: AfkStage[] = AFK_STAGES): CampaignViewModel | null {
  if (!stages.length) return null;

  const validStageIds = new Set(stages.map((stage) => stage.id));
  const safeCurrent = state?.campaign?.currentStageId ?? fallbackStageId(stages);
  const currentStageId = validStageIds.has(safeCurrent) ? safeCurrent : fallbackStageId(stages);

  const unlocked = new Set(
    (state?.campaign?.unlockedStageIds ?? [currentStageId]).filter((id) => validStageIds.has(id)).concat(currentStageId)
  );
  const completed = new Set((state?.campaign?.completedStageIds ?? []).filter((id) => validStageIds.has(id)));

  const stagesView: CampaignStageView[] = stages.map((stage, index) => ({
    id: stage.id,
    chapter: stage.chapter,
    index,
    recommendedPower: stage.recommendedPower,
    reward: stage.reward as AfkReward,
    state: deriveStageState(stage.id, unlocked, completed),
  }));

  const chapterLabel = `Chapter ${stages[0]?.chapter ?? 1}`;

  return {
    chapterLabel,
    currentStageId,
    stages: stagesView,
  };
}

export function loadCampaignViewModelFromStorage(): CampaignViewModel | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem("afk-state-v2");
  const parsed = raw ? (JSON.parse(raw) as Partial<AfkPlayerState>) : null;
  const normalized = normalizeAfkState(parsed, Date.now());
  return buildCampaignViewModel(normalized, AFK_STAGES);
}
