import type { GameSpec } from "../spec/gamespec.types.js";
import {
  migrateIdleRpgBaseSpec,
  type TemplateMigrationReport,
  type TemplateMigrationResult,
} from "./templates/idle-rpg-base.js";

export type { TemplateMigrationReport, TemplateMigrationResult };

export function migrateSpecForTemplate(
  spec: GameSpec,
  options: { templateId: string; fromVersion: string; toVersion: string }
): TemplateMigrationResult {
  if (options.templateId === "idle-rpg-base") {
    return migrateIdleRpgBaseSpec(spec, options);
  }
  throw new Error(`Migracion no soportada para template: ${options.templateId}`);
}
