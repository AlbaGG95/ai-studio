import type { GameSpec } from "../../spec/gamespec.types.js";

export interface TemplateMigrationReport {
  from: string;
  to: string;
  steps: string[];
}

export interface TemplateMigrationResult {
  spec: GameSpec;
  applied: TemplateMigrationReport;
}

function cloneSpec(spec: GameSpec): GameSpec {
  return JSON.parse(JSON.stringify(spec)) as GameSpec;
}

export function migrateIdleRpgBaseSpec(
  spec: GameSpec,
  options: { fromVersion: string; toVersion: string }
): TemplateMigrationResult {
  const { fromVersion, toVersion } = options;
  if (fromVersion === toVersion) {
    return {
      spec,
      applied: { from: fromVersion, to: toVersion, steps: [] },
    };
  }

  if (fromVersion === "1.1" && toVersion === "1.2") {
    const next = cloneSpec(spec);
    const steps: string[] = [];
    if (!next.systems.inventory) {
      next.systems.inventory = { enabled: false };
      steps.push("set systems.inventory.enabled=false");
    } else if (typeof next.systems.inventory.enabled !== "boolean") {
      next.systems.inventory.enabled = false;
      steps.push("set systems.inventory.enabled=false");
    }
    return {
      spec: next,
      applied: { from: fromVersion, to: toVersion, steps },
    };
  }

  throw new Error(
    `Migracion no soportada para idle-rpg-base: ${fromVersion} -> ${toVersion}`
  );
}
