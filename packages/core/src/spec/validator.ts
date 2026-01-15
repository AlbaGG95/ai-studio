import Ajv from "ajv";
import { GameSpec, ValidationResult } from "./gamespec.types";
import {
  FeatureManifest,
  FeatureValidationResult,
} from "./feature-manifest.types";
import gameSpecSchema from "../../spec/gamespec.schema.json" with { type: "json" };
import featureManifestSchema from "../../spec/feature-manifest.schema.json" with { type: "json" };

const ajv = new Ajv({
  allErrors: true,
  removeAdditional: false,
  useDefaults: true,
  coerceTypes: false,
});

const validateGameSpecSchema = ajv.compile<GameSpec>(gameSpecSchema as any);
const validateFeatureManifestSchema = ajv.compile<FeatureManifest>(
  featureManifestSchema as any
);

export function validateGameSpec(data: unknown): ValidationResult {
  const valid = validateGameSpecSchema(data);
  if (!valid) {
    return {
      valid: false,
      errors: validateGameSpecSchema.errors?.map(
        (err) => `${err.instancePath} ${err.message}`
      ),
    };
  }

  return {
    valid: true,
    data: data as GameSpec,
  };
}

export function parseAndValidateGameSpec(json: string): ValidationResult {
  try {
    const data = JSON.parse(json);
    return validateGameSpec(data);
  } catch (err) {
    return {
      valid: false,
      errors: [err instanceof Error ? err.message : "Unknown JSON parse error"],
    };
  }
}

export function validateGameSpecStrict(data: unknown): GameSpec {
  const result = validateGameSpec(data);
  if (!result.valid) {
    throw new Error(`GameSpec validation failed: ${result.errors?.join("; ")}`);
  }
  return result.data!;
}

export function validateFeatureManifest(
  data: unknown
): FeatureValidationResult {
  const valid = validateFeatureManifestSchema(data);
  if (!valid) {
    return {
      valid: false,
      errors: validateFeatureManifestSchema.errors?.map(
        (err) => `${err.instancePath} ${err.message}`
      ),
    };
  }

  return {
    valid: true,
    data: data as FeatureManifest,
  };
}

export function parseAndValidateFeatureManifest(
  json: string
): FeatureValidationResult {
  try {
    const data = JSON.parse(json);
    return validateFeatureManifest(data);
  } catch (err) {
    return {
      valid: false,
      errors: [err instanceof Error ? err.message : "Unknown JSON parse error"],
    };
  }
}

export function validateFeatureManifestStrict(
  data: unknown
): FeatureManifest {
  const result = validateFeatureManifest(data);
  if (!result.valid) {
    throw new Error(
      `Feature Manifest validation failed: ${result.errors?.join("; ")}`
    );
  }
  return result.data!;
}
