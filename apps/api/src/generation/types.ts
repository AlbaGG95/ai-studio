import type { FeatureConstraints, FeatureFileRole } from "@ai-studio/core";

export type ModuleKind = "system" | "renderer" | "ui";

export interface ModuleGenerationFile {
  path: string;
  content: string;
  role?: FeatureFileRole;
}

export interface ModuleGenerationInput {
  module: {
    id: string;
    name?: string;
    kind: ModuleKind;
    entry?: string;
    templateId?: string;
  };
  provides?: {
    events?: string[];
    state?: string[];
    commands?: string[];
  };
  consumes?: {
    events?: string[];
    state?: string[];
    commands?: string[];
  };
  constraints?: FeatureConstraints;
  files?: ModuleGenerationFile[];
  spec?: unknown;
}

export interface GenerationFileRecord {
  path: string;
  role: FeatureFileRole;
  sha256: string;
  sizeBytes: number;
}

export interface GenerationResult {
  generationId: string;
  buildId: string;
  manifestPath: string;
  filesDir: string;
  files: GenerationFileRecord[];
  validationOk: boolean;
}
