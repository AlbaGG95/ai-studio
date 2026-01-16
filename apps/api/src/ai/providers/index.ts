import type { PresetProvider } from "./types.js";
import { mockProvider } from "./mockProvider.js";
import { createOllamaProvider } from "./ollamaProvider.js";

export function getPresetProvider(): PresetProvider {
  const selected = process.env.AI_PROVIDER || "mock";
  if (selected === "ollama") {
    return createOllamaProvider();
  }
  return mockProvider;
}
