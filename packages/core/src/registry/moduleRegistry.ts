import type { GameSpec } from "../spec/gamespec.types.js";

export interface ModuleSelection {
  modules: string[];
}

const BASE_MODULES = ["idle-loop", "combat", "progression"] as const;

export function resolveModulesForSpec(spec: GameSpec): ModuleSelection {
  const modules: string[] = [...BASE_MODULES];

  if (spec.systems.inventory?.enabled) {
    modules.push("inventory");
  }

  return { modules };
}
