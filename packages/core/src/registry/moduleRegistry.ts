import type { GameSpec } from "../spec/gamespec.types.js";
import templateRegistry from "../../spec/template-registry.json" with { type: "json" };

export interface ModuleSelection {
  templateId: string;
  baseModules: string[];
  conditionsApplied: AppliedCondition[];
  modules: string[];
}

interface TemplateRegistryCondition {
  when: {
    path: string;
    equals: unknown;
  };
  add: string[];
}

interface TemplateRegistryEntry {
  baseModules: string[];
  conditionalModules?: TemplateRegistryCondition[];
}

interface TemplateRegistry {
  version: string;
  templates: Record<string, TemplateRegistryEntry>;
}

export interface AppliedCondition {
  path: string;
  equals: unknown;
  add: string[];
}

function readPathValue(value: unknown, pathValue: string): unknown {
  if (!pathValue) return undefined;
  const parts = pathValue.split(".").filter(Boolean);
  let current: unknown = value;
  for (const part of parts) {
    if (!current || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function uniqueOrdered(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    if (!seen.has(value)) {
      seen.add(value);
      result.push(value);
    }
  }
  return result;
}

export function resolveModulesForSpec(spec: GameSpec): ModuleSelection {
  const registry = templateRegistry as TemplateRegistry;
  const templateId = spec.engine.templateId;
  const template = registry.templates[templateId];
  if (!template) {
    throw new Error(`Template no registrado: ${templateId}`);
  }

  const baseModules = [...template.baseModules];
  const modules = [...baseModules];
  const conditionsApplied: AppliedCondition[] = [];

  for (const condition of template.conditionalModules || []) {
    const value = readPathValue(spec, condition.when.path);
    if (value === condition.when.equals) {
      conditionsApplied.push({
        path: condition.when.path,
        equals: condition.when.equals,
        add: condition.add,
      });
      modules.push(...condition.add);
    }
  }

  return {
    templateId,
    baseModules: uniqueOrdered(baseModules),
    conditionsApplied,
    modules: uniqueOrdered(modules),
  };
}
