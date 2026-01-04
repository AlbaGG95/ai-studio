import { AfkBattleUnit as BattleUnit, VisualDNA, HeroSkill } from "@ai-studio/core";

export type TeamSide = "ally" | "enemy";

export interface UnitPresentation {
  unit: BattleUnit;
  visuals?: VisualDNA;
  skills?: HeroSkill[];
}

export interface SlotPosition {
  x: number;
  y: number;
}
