export interface PresetProviderResult {
  preset: unknown;
  raw: string;
  provider: string;
  model?: string;
}

export interface PresetProvider {
  name: string;
  model?: string;
  generatePreset(prompt: string): Promise<PresetProviderResult>;
}
