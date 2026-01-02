import { Stage } from "./types.js";

export const MAX_STAGE = 20;

function rewardAt(index: number) {
  const baseGold = 20 + index * 3;
  const baseExp = 8 + index * 2;
  const baseMat = 4 + Math.floor(index * 1.2);
  return {
    gold: baseGold,
    exp: baseExp,
    materials: baseMat,
  };
}

export function buildStages(chapter = 1): Stage[] {
  const list: Stage[] = [];
  for (let i = 1; i <= MAX_STAGE; i += 1) {
    list.push({
      id: `${chapter}-${i}`,
      chapter,
      index: i,
      recommendedPower: 50 + i * 20,
      enemyPower: 40 + i * 18,
      reward: rewardAt(i),
      unlocked: i === 1,
    });
  }
  return list;
}

export function findStage(stages: Stage[], id: string): Stage | undefined {
  return stages.find((s) => s.id === id);
}

export function nextStageId(stages: Stage[], currentId: string): string | null {
  const idx = stages.findIndex((s) => s.id === currentId);
  if (idx === -1 || idx === stages.length - 1) return null;
  return stages[idx + 1].id;
}
