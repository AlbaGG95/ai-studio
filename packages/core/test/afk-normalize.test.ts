import assert from "node:assert/strict";
import test from "node:test";
import { BASE_STAGES as AFK_STAGES } from "../afk/state.js";
import { normalizeAfkState } from "../../../apps/web/src/lib/afkStore.tsx";

const NOW = Date.now();

test("normalize fills missing campaign and stage defaults", () => {
  const partial = { resources: { gold: 10, exp: 2, materials: 1 } } as any;
  const normalized = normalizeAfkState(partial, NOW);
  assert(normalized.campaign, "campaign should exist");
  assert(normalized.campaign.currentStageId, "currentStageId should be set");
  assert.equal(normalized.campaign.currentStageId, AFK_STAGES[0].id);
  assert(normalized.idle.bank, "idle bank exists");
});

test("normalize falls back on unknown stage id", () => {
  const partial = {
    campaign: { currentStageId: "9-9", unlockedStageIds: [], completedStageIds: [] },
  } as any;
  const normalized = normalizeAfkState(partial, NOW);
  assert.equal(normalized.campaign.currentStageId, AFK_STAGES[0].id, "unknown stage id falls back");
});
