import gameSpecSchema from "./gamespec.schema.json" with { type: "json" };
import featureManifestSchema from "./feature-manifest.schema.json" with { type: "json" };
import presetSchema from "./preset.schema.json" with { type: "json" };

export * from "../src/spec/index.js";
export { gameSpecSchema, featureManifestSchema, presetSchema };
