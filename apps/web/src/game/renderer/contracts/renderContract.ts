import type { CombatEvent, CombatSnapshot } from "../types/combat";

export type BattleRenderInput = {
  stageId: string;
  speed: 1 | 2;
  seed: number;
  snapshot: CombatSnapshot;
  events: CombatEvent[];
};

export type MapRenderInput = {
  // Placeholder for future map renderer contract
};
