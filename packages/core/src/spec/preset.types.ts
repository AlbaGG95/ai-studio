import type {
  DamageFormula,
  GameLanguage,
  ProgressionScaling,
  TemplateId,
} from "./gamespec.types.js";

export type PresetPacing = "slow" | "normal" | "fast";
export type PresetDifficulty = "easy" | "normal" | "hard";
export type PresetEconomy = "stingy" | "normal" | "generous";

export interface PresetMeta {
  name: string;
  version: string;
  language: GameLanguage;
  templateId: TemplateId;
}

export interface PresetTuning {
  pacing: PresetPacing;
  difficulty: PresetDifficulty;
  economy: PresetEconomy;
  inventoryEnabled: boolean;
  damageFormula: DamageFormula;
  progressionScaling: ProgressionScaling;
  levels: number;
}

export interface Preset {
  meta: PresetMeta;
  tuning: PresetTuning;
  seed?: string;
}

export interface PresetValidationResult {
  valid: boolean;
  errors?: string[];
  data?: Preset;
}
