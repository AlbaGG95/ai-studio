import Ajv from "ajv";
import { GameSpec, ValidationResult } from "./gamespec.types";
import schema from "./gamespec.schema.json" with { type: "json" };

const ajv = new Ajv({
  removeAdditional: false,
  useDefaults: true,
  coerceTypes: false,
});

/**
 * Compile the schema into a validator function
 */
const validate = ajv.compile<GameSpec>(schema as any);

/**
 * Validate a GameSpec object against the schema
 */
export function validateGameSpec(data: unknown): ValidationResult {
  const valid = validate(data);

  if (!valid) {
    return {
      valid: false,
      errors: validate.errors?.map(
        (err) => `${err.instancePath} ${err.message}`
      ),
    };
  }

  return {
    valid: true,
    data: data as GameSpec,
  };
}

/**
 * Parse JSON and validate as GameSpec
 */
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

/**
 * Validate and throw on error
 */
export function validateGameSpecStrict(data: unknown): GameSpec {
  const result = validateGameSpec(data);
  if (!result.valid) {
    throw new Error(`GameSpec validation failed: ${result.errors?.join("; ")}`);
  }
  return result.data!;
}
