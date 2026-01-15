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
  applied: boolean;
  error?: string;
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

function evaluateLeafCondition(
  condition: ConditionLeaf,
  spec: GameSpec
): { result: boolean; error?: string } {
  const value = readPathValue(spec, condition.path);
  if ("exists" in condition) {
    const exists = value !== undefined;
    return { result: condition.exists ? exists : !exists };
  }

  if (value === undefined) return { result: false };

  const checks: boolean[] = [];
  if ("equals" in condition) {
    checks.push(value === condition.equals);
  }
  if ("in" in condition) {
    const allowed = Array.isArray(condition.in) ? condition.in : [];
    checks.push(allowed.includes(value));
  }
  if ("gte" in condition) {
    checks.push(
      typeof value === "number" &&
        typeof condition.gte === "number" &&
        value >= condition.gte
    );
  }
  if ("lte" in condition) {
    checks.push(
      typeof value === "number" &&
        typeof condition.lte === "number" &&
        value <= condition.lte
    );
  }

  if (checks.length === 0) {
    return { result: false, error: "Condicion sin operador valido" };
  }
  return { result: checks.every(Boolean) };
}

function evaluateConditionNode(
  condition: ConditionNode,
  spec: GameSpec
): { result: boolean; error?: string } {
  if (isGroup(condition)) {
    if ("and" in condition) {
      if (!Array.isArray(condition.and)) {
        return { result: false, error: "Condicion and invalida" };
      }
      const results = condition.and.map((entry) =>
        isLeaf(entry) ? evaluateLeafCondition(entry, spec) : { result: false }
      );
      const hasInvalid = condition.and.some((entry) => !isLeaf(entry));
      const error = hasInvalid ? "Condicion and invalida" : undefined;
      return {
        result: results.every((value) => value.result),
        error,
      };
    }
    if ("or" in condition) {
      if (!Array.isArray(condition.or)) {
        return { result: false, error: "Condicion or invalida" };
      }
      const results = condition.or.map((entry) =>
        isLeaf(entry) ? evaluateLeafCondition(entry, spec) : { result: false }
      );
      const hasInvalid = condition.or.some((entry) => !isLeaf(entry));
      const error = hasInvalid ? "Condicion or invalida" : undefined;
      return {
        result: results.some((value) => value.result),
        error,
      };
    }
  }

  if (isLeaf(condition)) {
    return evaluateLeafCondition(condition, spec);
  }

  return { result: false, error: "Condicion invalida" };
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
    const evaluation = evaluateConditionNode(condition.when, spec);
    const applied = evaluation.result;
    conditionsEvaluated.push({
      condition: condition.when,
      result: evaluation.result,
      applied,
      error: evaluation.error,
    });
    if (applied) {
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
