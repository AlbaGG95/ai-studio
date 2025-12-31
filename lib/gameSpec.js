export const GAME_TYPES = [
  "idle_rpg",
  "clicker",
  "runner",
  "tower_defense",
  "trivia",
  "platformer_simple",
  "match3",
];

export function validateGameSpec(candidate) {
  const errors = [];
  const spec = candidate || {};

  if (!spec || typeof spec !== "object") {
    return { ok: false, errors: ["Spec must be an object"] };
  }
  if (spec.version !== "1.0") errors.push("version must be '1.0'");
  if (!spec.title) errors.push("title is required");
  if (!spec.type) errors.push("type is required");

  if (!spec.theme || typeof spec.theme !== "object") {
    errors.push("theme is required");
  } else {
    if (!spec.theme.name) errors.push("theme.name is required");
    if (!["dark", "light", "epic", "casual"].includes(spec.theme.tone)) {
      errors.push("theme.tone must be one of dark|light|epic|casual");
    }
  }

  if (!spec.rules || typeof spec.rules !== "object") {
    errors.push("rules are required");
  } else {
    if (!spec.rules.objective) errors.push("rules.objective is required");
    if (!Array.isArray(spec.rules.controls)) errors.push("rules.controls must be an array");
    if (!spec.rules.winCondition) errors.push("rules.winCondition is required");
  }

  if (!spec.content || typeof spec.content !== "object") {
    errors.push("content is required");
  } else if (!Array.isArray(spec.content.entities)) {
    errors.push("content.entities must be an array");
  }

  if (!spec.ui || typeof spec.ui !== "object") {
    errors.push("ui is required");
  } else if (!["bottom_nav", "sidebar", "single_screen"].includes(spec.ui.layout)) {
    errors.push("ui.layout must be one of bottom_nav|sidebar|single_screen");
  }

  return { ok: errors.length === 0, errors };
}
