import gameSpecSchema from "./gamespec.schema.json" with { type: "json" };

export * from "./gamespec.types.js";
export {
  validateGameSpec,
  parseAndValidateGameSpec,
  validateGameSpecStrict,
} from "./validator.js";
export { gameSpecSchema };
