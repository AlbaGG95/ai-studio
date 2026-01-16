import type { GameSpec } from "../spec/gamespec.types.js";
import templateRegistry from "../../spec/template-registry.json" with { type: "json" };

export interface ModuleSelection {
  templateId: string;
  templateVersionUsed: string;
  templateVersionLatest: string;
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

export interface TemplateRegistryVersionedEntry {
  latest: string;
  versions: Record<string, TemplateRegistryEntry>;
}

export type TemplateRegistryTemplate =
  | TemplateRegistryEntry
  | TemplateRegistryVersionedEntry;

export interface TemplateRegistry {
  version: string;
  templates: Record<string, TemplateRegistryTemplate>;
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

export interface ParsedTemplateId {
  id: string;
  version?: string;
}

export interface TemplateResolution {
  templateId: string;
  requestedVersion?: string;
  versionUsed: string;
  latestVersion: string;
  entry: TemplateRegistryEntry;
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

export function parseTemplateId(templateId: string): ParsedTemplateId {
  const trimmed = templateId.trim();
  const match = /^([a-z0-9-]+)(?:@(\d+\.\d+))?$/.exec(trimmed);
  if (!match) {
    throw new Error(`TemplateId invalido: ${templateId}`);
  }
  const [, id, version] = match;
  return { id, version };
}

function isVersionedTemplate(
  template: TemplateRegistryTemplate
): template is TemplateRegistryVersionedEntry {
  return (
    typeof template === "object" &&
    template !== null &&
    "versions" in template &&
    "latest" in template
  );
}

export function resolveTemplateFromRegistry(
  templateIdValue: string,
  registry: TemplateRegistry
): TemplateResolution {
  const parsed = parseTemplateId(templateIdValue);
  const template = registry.templates[parsed.id];
  if (!template) {
    throw new Error(`Template no registrado: ${parsed.id}`);
  }

  if (isVersionedTemplate(template)) {
    const latestVersion = template.latest;
    if (!template.versions[latestVersion]) {
      throw new Error(
        `Template sin version latest valida: ${parsed.id}@${latestVersion}`
      );
    }
    const requestedVersion = parsed.version;
    const versionUsed = requestedVersion ?? latestVersion;
    const entry = template.versions[versionUsed];
    if (!entry) {
      throw new Error(
        `Template version no registrada: ${parsed.id}@${versionUsed}`
      );
    }
    return {
      templateId: parsed.id,
      requestedVersion,
      versionUsed,
      latestVersion,
      entry,
    };
  }

  const requestedVersion = parsed.version;
  if (requestedVersion && requestedVersion !== "1.0") {
    throw new Error(
      `Template version no registrada: ${parsed.id}@${requestedVersion}`
    );
  }

  return {
    templateId: parsed.id,
    requestedVersion,
    versionUsed: requestedVersion ?? "1.0",
    latestVersion: "1.0",
    entry: template,
  };
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
  const resolution = resolveTemplateFromRegistry(
    spec.engine.templateId,
    registry
  );
  const baseModules = [...resolution.entry.baseModules];
  const modules = [...baseModules];
  const conditionsApplied: AppliedCondition[] = [];
  const conditionsEvaluated: ConditionEvaluation[] = [];

  for (const condition of resolution.entry.conditionalModules || []) {
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
    templateId: resolution.templateId,
    templateVersionUsed: resolution.versionUsed,
    templateVersionLatest: resolution.latestVersion,
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
