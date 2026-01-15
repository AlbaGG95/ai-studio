export type FeatureManifestVersion = "1.0";
export type FeatureModuleKind = "system" | "renderer" | "ui";
export type FeatureFileRole = "logic" | "render" | "ui" | "asset";
export type FeatureAssetType = "image" | "audio" | "data";

export interface FeatureModule {
  id: string;
  name: string;
  kind: FeatureModuleKind;
  entry: string;
  templateId: string;
}

export interface FeatureIo {
  events: string[];
  state: string[];
  commands: string[];
}

export interface FeatureFile {
  path: string;
  role: FeatureFileRole;
  sha256: string;
}

export interface FeatureAsset {
  id: string;
  type: FeatureAssetType;
  path: string;
  sha256: string;
  sizeBytes: number;
}

export interface FeatureConstraints {
  maxBundleKb?: number;
  maxTickMs?: number;
}

export interface FeatureManifest {
  version: FeatureManifestVersion;
  module: FeatureModule;
  provides: FeatureIo;
  consumes: FeatureIo;
  files: FeatureFile[];
  assets?: FeatureAsset[];
  constraints?: FeatureConstraints;
}

export interface FeatureValidationResult {
  valid: boolean;
  errors?: string[];
  data?: FeatureManifest;
}
