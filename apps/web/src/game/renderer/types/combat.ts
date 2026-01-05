export type Team = "ally" | "enemy";

export type CombatUnitSnapshot = {
  id: string;
  name: string;
  team: Team;
  hp: number;
  maxHp: number;
  slotIndex: number; // 0..4 per team
};

export type CombatSnapshot = {
  stageLabel: string;
  units: CombatUnitSnapshot[];
};

export type CombatEvent =
  | { type: "attack"; sourceId: string; targetId: string; skillId?: string; order: number }
  | { type: "hit"; sourceId: string; targetId: string; value: number; order: number }
  | { type: "crit"; sourceId: string; targetId: string; value: number; order: number }
  | { type: "heal"; sourceId: string; targetId: string; value: number; order: number }
  | { type: "death"; targetId: string; order: number }
  | { type: "stage_end"; result: "victory" | "defeat"; order: number };

export type CombatReplay = {
  snapshot: CombatSnapshot;
  events: CombatEvent[];
};
