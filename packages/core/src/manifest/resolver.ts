import type { FeatureManifest } from "../spec/feature-manifest.types.js";

export type ManifestDependencyType = "event" | "state" | "command";

export interface ManifestMissingDependency {
  moduleId: string;
  type: ManifestDependencyType;
  key: string;
}

export interface ManifestGraphEdge {
  from: string;
  to: string;
  reason: string;
}

export interface ManifestGraph {
  nodes: string[];
  edges: ManifestGraphEdge[];
  missing: ManifestMissingDependency[];
  cycles: string[][];
}

export interface ManifestResolverOptions {
  allowlistPrefixes?: string[];
}

const DEFAULT_ALLOWLIST = ["core.", "system."];

function isAllowlisted(key: string, allowlist: string[]) {
  return allowlist.some((prefix) => key.startsWith(prefix));
}

function pushProvides(
  map: Map<string, Set<string>>,
  moduleId: string,
  keys: string[]
) {
  for (const key of keys) {
    const set = map.get(key) || new Set();
    set.add(moduleId);
    map.set(key, set);
  }
}

function buildAdjacency(edges: ManifestGraphEdge[]) {
  const adjacency = new Map<string, Set<string>>();
  for (const edge of edges) {
    const set = adjacency.get(edge.from) || new Set();
    set.add(edge.to);
    adjacency.set(edge.from, set);
  }
  return adjacency;
}

function detectCycles(nodes: string[], edges: ManifestGraphEdge[]) {
  const adjacency = buildAdjacency(edges);
  const visitState = new Map<string, number>();
  const stack: string[] = [];
  const cycles: string[][] = [];

  const visit = (node: string) => {
    const state = visitState.get(node) || 0;
    if (state === 1) {
      const startIndex = stack.indexOf(node);
      if (startIndex >= 0) {
        cycles.push([...stack.slice(startIndex), node]);
      }
      return;
    }
    if (state === 2) return;
    visitState.set(node, 1);
    stack.push(node);
    const neighbors = adjacency.get(node) || new Set();
    for (const next of neighbors) {
      visit(next);
    }
    stack.pop();
    visitState.set(node, 2);
  };

  for (const node of nodes) {
    if ((visitState.get(node) || 0) === 0) {
      visit(node);
    }
  }

  return cycles;
}

export function buildManifestGraph(
  manifests: FeatureManifest[],
  options: ManifestResolverOptions = {}
): ManifestGraph {
  const allowlist = options.allowlistPrefixes || DEFAULT_ALLOWLIST;
  const nodes = manifests.map((manifest) => manifest.module.id);
  const providesEvents = new Map<string, Set<string>>();
  const providesState = new Map<string, Set<string>>();
  const providesCommands = new Map<string, Set<string>>();

  for (const manifest of manifests) {
    pushProvides(providesEvents, manifest.module.id, manifest.provides.events);
    pushProvides(providesState, manifest.module.id, manifest.provides.state);
    pushProvides(
      providesCommands,
      manifest.module.id,
      manifest.provides.commands
    );
  }

  const edges: ManifestGraphEdge[] = [];
  const missing: ManifestMissingDependency[] = [];

  const resolveDependency = (
    manifest: FeatureManifest,
    type: ManifestDependencyType,
    key: string,
    providers: Map<string, Set<string>>
  ) => {
    if (isAllowlisted(key, allowlist)) return;
    const providerIds = providers.get(key);
    if (!providerIds || providerIds.size === 0) {
      missing.push({ moduleId: manifest.module.id, type, key });
      return;
    }
    for (const providerId of providerIds) {
      if (providerId === manifest.module.id) continue;
      edges.push({
        from: manifest.module.id,
        to: providerId,
        reason: `${type}:${key}`,
      });
    }
  };

  for (const manifest of manifests) {
    for (const key of manifest.consumes.events) {
      resolveDependency(manifest, "event", key, providesEvents);
    }
    for (const key of manifest.consumes.state) {
      resolveDependency(manifest, "state", key, providesState);
    }
    for (const key of manifest.consumes.commands) {
      resolveDependency(manifest, "command", key, providesCommands);
    }
  }

  return {
    nodes,
    edges,
    missing,
    cycles: detectCycles(nodes, edges),
  };
}
