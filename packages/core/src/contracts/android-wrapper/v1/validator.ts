import Ajv from "ajv";
import schema from "./android-wrapper.schema.json" with { type: "json" };
import type {
  AndroidWrapperSpec,
  AndroidWrapperValidationResult,
} from "./types.js";

const ajv = new Ajv({
  allErrors: true,
  removeAdditional: false,
  useDefaults: true,
  coerceTypes: false,
});

const validateSchema = ajv.compile<AndroidWrapperSpec>(schema as any);

export function validateAndroidWrapperSpec(
  data: unknown
): AndroidWrapperValidationResult {
  const valid = validateSchema(data);
  if (!valid) {
    return {
      valid: false,
      errors: validateSchema.errors?.map(
        (err) => `${err.instancePath} ${err.message}`
      ),
    };
  }
  return {
    valid: true,
    data: data as AndroidWrapperSpec,
  };
}

export function parseAndValidateAndroidWrapperSpec(
  json: string
): AndroidWrapperValidationResult {
  try {
    const data = JSON.parse(json);
    return validateAndroidWrapperSpec(data);
  } catch (err) {
    return {
      valid: false,
      errors: [err instanceof Error ? err.message : "Unknown JSON parse error"],
    };
  }
}

export function validateAndroidWrapperSpecStrict(
  data: unknown
): AndroidWrapperSpec {
  const result = validateAndroidWrapperSpec(data);
  if (!result.valid) {
    throw new Error(
      `AndroidWrapperSpec validation failed: ${result.errors?.join("; ")}`
    );
  }
  return result.data!;
}
