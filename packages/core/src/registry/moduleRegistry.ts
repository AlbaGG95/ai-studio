import type { GameSpec } from "../spec/gamespec.types.js";
import templateRegistry from "../../spec/template-registry.json" with { type: "json" };

export interface ModuleSelection {
  templateId: string;
  baseModules: string[];
  conditionsApplied: AppliedCondition[];
  conditionsEvaluated: ConditionEvaluation[];
  modules: string[];
}

export type ConditionLeaf = {
  path: string;
  equals?: unknown;
  exists?: boolean;
  in?: unknown[];
  gte?: number;
  lte?: number;
};

export type ConditionGroup =
  | {
      and: ConditionLeaf[];
    }
  | {
      or: ConditionLeaf[];
    };

export type ConditionNode = ConditionLeaf | ConditionGroup;

export interface TemplateRegistryCondition {
  when: ConditionNode;
  add: string[];
}

export interface TemplateRegistryEntry {
  baseModules: string[];
  conditionalModules?: TemplateRegistryCondition[];
}

export interface TemplateRegistry {
  version: string;
  templates: Record<string, TemplateRegistryEntry>;
}

export interface AppliedCondition {
  condition: ConditionNode;
  add: string[];
}

export interface ConditionEvaluation {
  condition: ConditionNode;
  result: boolean;
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

function isGroup(condition: ConditionNode): condition is ConditionGroup {
  return (
    typeof condition === "object" &&
    condition !== null &&
    ("and" in condition || "or" in condition)
  );
}

function isLeaf(condition: ConditionNode): condition is ConditionLeaf {
  return (
    typeof condition === "object" &&
    condition !== null &&
    "path" in condition
  );
}

function evaluateLeafCondition(condition: ConditionLeaf, spec: GameSpec): boolean {
  const value = readPathValue(spec, condition.path);
  if ("exists" in condition) {
    const exists = value !== undefined;
    return condition.exists ? exists : !exists;
  }

  if (value === undefined) return false;

  const checks: boolean[] = [];
  if ("equals" in condition) {
    checks.push(value === condition.equals);
  }
  if ("in" in condition) {
    const allowed = Array.isArray(condition.in) ? condition.in : [];
    checks.push(allowed.includes(value));
  }
  if ("gte" in condition) {
    checks.push(typeof value === "number" && typeof condition.gte === "number" && value >= condition.gte);
  }
  if ("lte" in condition) {
    checks.push(typeof value === "number" && typeof condition.lte === "number" && value <= condition.lte);
  }

  if (checks.length === 0) {
    return false;
  }
  return checks.every(Boolean);
}

function evaluateConditionNode(condition: ConditionNode, spec: GameSpec): boolean {
  if (isGroup(condition)) {
    if ("and" in condition) {
      if (!Array.isArray(condition.and)) return false;
      return condition.and.every((entry) => isLeaf(entry) && evaluateLeafCondition(entry, spec));
    }
    if ("or" in condition) {
      if (!Array.isArray(condition.or)) return false;
      return condition.or.some((entry) => isLeaf(entry) && evaluateLeafCondition(entry, spec));
    }
  }

  if (isLeaf(condition)) {
    return evaluateLeafCondition(condition, spec);
  }

  return false;
}

export function resolveModulesForSpecWithRegistry(
  spec: GameSpec,
  registry: TemplateRegistry
): ModuleSelection {
  const templateId = spec.engine.templateId;
  const template = registry.templates[templateId];
  if (!template) {
    throw new Error(`Template no registrado: ${templateId}`);
  }

  const baseModules = [...template.baseModules];
  const modules = [...baseModules];
  const conditionsApplied: AppliedCondition[] = [];
  const conditionsEvaluated: ConditionEvaluation[] = [];

  for (const condition of template.conditionalModules || []) {
    const result = evaluateConditionNode(condition.when, spec);
    conditionsEvaluated.push({
      condition: condition.when,
      result,
    });
    if (result) {
      conditionsApplied.push({
        condition: condition.when,
        add: condition.add,
      });
      modules.push(...condition.add);
    }
  }

  return {
    templateId,
    baseModules: uniqueOrdered(baseModules),
    conditionsApplied,
    conditionsEvaluated,
    modules: uniqueOrdered(modules),
  };
}

export function resolveModulesForSpec(spec: GameSpec): ModuleSelection {
  const registry = templateRegistry as TemplateRegistry;
  return resolveModulesForSpecWithRegistry(spec, registry);
}
