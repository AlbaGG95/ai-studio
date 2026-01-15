import assert from "node:assert/strict";
import test from "node:test";
import { buildManifestGraph } from "../src/manifest/resolver.js";
import type { FeatureManifest } from "../src/spec/feature-manifest.types.js";

const HASH = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

function makeManifest(
  id: string,
  provides: Partial<FeatureManifest["provides"]>,
  consumes: Partial<FeatureManifest["consumes"]>
): FeatureManifest {
  return {
    version: "1.0",
    module: {
      id,
      name: id,
      kind: "system",
      entry: `modules/${id}/index.ts`,
      templateId: "idle-rpg-base",
    },
    provides: {
      events: [],
      state: [],
      commands: [],
      ...provides,
    },
    consumes: {
      events: [],
      state: [],
      commands: [],
      ...consumes,
    },
    files: [
      {
        path: `modules/${id}/index.ts`,
        role: "logic",
        sha256: HASH,
      },
    ],
  };
}

test("resolver reports missing dependencies", () => {
  const manifest = makeManifest(
    "mod-a",
    {},
    { events: ["missing.event"] }
  );
  const graph = buildManifestGraph([manifest]);
  assert.equal(graph.missing.length, 1);
  assert.equal(graph.missing[0].moduleId, "mod-a");
  assert.equal(graph.missing[0].key, "missing.event");
  assert.equal(graph.cycles.length, 0);
});

test("resolver detects cycles and returns path", () => {
  const a = makeManifest("mod-a", { events: ["a.out"] }, { events: ["c.out"] });
  const b = makeManifest("mod-b", { events: ["b.out"] }, { events: ["a.out"] });
  const c = makeManifest("mod-c", { events: ["c.out"] }, { events: ["b.out"] });
  const graph = buildManifestGraph([a, b, c]);
  assert.ok(graph.cycles.length > 0);
  const cycle = graph.cycles.find(
    (path) =>
      path.includes("mod-a") &&
      path.includes("mod-b") &&
      path.includes("mod-c")
  );
  assert.ok(cycle, "cycle path should include all modules");
  if (cycle) {
    assert.equal(cycle[0], cycle[cycle.length - 1]);
  }
});
