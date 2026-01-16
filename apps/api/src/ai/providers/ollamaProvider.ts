import type { PresetProvider, PresetProviderResult } from "./types.js";

const OLLAMA_URL = "http://localhost:11434/api/generate";

export function createOllamaProvider(): PresetProvider {
  const model = process.env.AI_MODEL || "llama3";
  return {
    name: "ollama",
    model,
    async generatePreset(prompt: string): Promise<PresetProviderResult> {
      const response = await fetch(OLLAMA_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          prompt,
          stream: false,
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Ollama error ${response.status}: ${text}`);
      }

      const data = (await response.json()) as { response?: string };
      const raw = typeof data.response === "string" ? data.response.trim() : "";
      let preset: unknown = null;
      try {
        preset = JSON.parse(raw);
      } catch {
        preset = null;
      }
      return {
        preset,
        raw,
        provider: "ollama",
        model,
      };
    },
  };
}
