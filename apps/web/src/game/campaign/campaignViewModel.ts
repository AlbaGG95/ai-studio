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

export function getCurrentStageId(stages: AfkStage[], completed: Set<string>): string {
  const fallback = fallbackStageId(stages);
  for (const stage of stages) {
    if (!completed.has(stage.id)) return stage.id;
  }
  return fallback;
}

export function isStageCompleted(stageId: string, completed: Set<string>): boolean {
  return completed.has(stageId);
}

export function isStageUnlocked(stageId: string, currentStageId: string, completed: Set<string>): boolean {
  return stageId === currentStageId || completed.has(stageId);
}

export function buildCampaignViewModel(state: AfkPlayerState | null, stages: AfkStage[] = AFK_STAGES): CampaignViewModel | null {
  if (!stages.length) return null;

  const validStageIds = new Set(stages.map((stage) => stage.id));
  const completed = new Set((state?.campaign?.completedStageIds ?? []).filter((id) => validStageIds.has(id)));
  const currentStageId = getCurrentStageId(stages, completed);

  const unlocked = new Set<string>(completed);
  unlocked.add(currentStageId);

  const stagesView: CampaignStageView[] = stages.map((stage, index) => ({
    id: stage.id,
    chapter: stage.chapter,
    index,
    recommendedPower: stage.recommendedPower,
    reward: stage.reward as AfkReward,
    state: isStageCompleted(stage.id, completed) ? "completed" : isStageUnlocked(stage.id, currentStageId, completed) ? "ready" : "locked",
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
