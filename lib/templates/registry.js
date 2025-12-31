import { validateGameSpec } from "../gameSpec.js";

export const TemplateId = {
  idle_rpg_afk: "idle_rpg_afk",
  clicker_basic: "clicker_basic",
  runner_endless: "runner_endless",
  tower_defense_basic: "tower_defense_basic",
  trivia_basic: "trivia_basic",
  match3_basic: "match3_basic",
  platformer_basic: "platformer_basic",
  placeholder_basic: "placeholder_basic",
};

const templates = [
  {
    id: TemplateId.idle_rpg_afk,
    type: "idle_rpg",
    canHandle: (spec) => spec.type === "idle_rpg",
    build: (spec) => {
      const configId = spec.theme?.tone === "dark" || spec.theme?.tone === "epic" ? "fantasy_dark" : "scifi_clean";
      return {
        route: `/afk?configId=${configId}`,
        config: { title: spec.title, theme: spec.theme, rules: spec.rules, content: spec.content, configId },
        notes: ["AFK/idle RPG base template"],
      };
    },
  },
  {
    id: TemplateId.clicker_basic,
    type: "clicker",
    canHandle: (spec) => spec.type === "clicker",
    build: (spec) => ({
      route: "/play?templateId=clicker_basic",
      config: { title: spec.title, content: spec.content },
      notes: ["Clicker basic template"],
    }),
  },
  {
    id: TemplateId.runner_endless,
    type: "runner",
    canHandle: (spec) => spec.type === "runner",
    build: (spec) => ({
      route: `/play?templateId=${TemplateId.runner_endless}&fallback=placeholder_basic&title=${encodeURIComponent(spec.title)}`,
      config: { title: spec.title, content: spec.content },
      notes: ["Endless runner template"],
    }),
  },
  {
    id: TemplateId.tower_defense_basic,
    type: "tower_defense",
    canHandle: (spec) => spec.type === "tower_defense",
    build: (spec) => ({
      route: "/play?templateId=td_basic",
      config: { title: spec.title, content: spec.content },
      notes: ["Tower defense basic template"],
    }),
  },
  {
    id: TemplateId.trivia_basic,
    type: "trivia",
    canHandle: (spec) => spec.type === "trivia",
    build: (spec) => ({
      route: "/play?templateId=trivia_basic",
      config: { title: spec.title, content: spec.content, questions: spec.content?.entities },
      notes: ["Trivia basic template"],
    }),
  },
  {
    id: TemplateId.match3_basic,
    type: "match3",
    canHandle: (spec) => spec.type === "match3",
    build: (spec) => ({
      route: "/play?templateId=match3_basic",
      config: { title: spec.title, content: spec.content },
      notes: ["Match3 basic template"],
    }),
  },
  {
    id: TemplateId.platformer_basic,
    type: "platformer_simple",
    canHandle: (spec) => spec.type === "platformer_simple",
    build: (spec) => ({
      route: "/play?templateId=platformer_basic",
      config: { title: spec.title, content: spec.content },
      notes: ["Platformer simple template"],
    }),
  },
  {
    id: TemplateId.placeholder_basic,
    type: "idle_rpg",
    canHandle: () => true,
    build: (spec) => ({
      route: `/play?templateId=${TemplateId.placeholder_basic}&title=${encodeURIComponent(spec.title)}`,
      config: { title: spec.title, spec },
      notes: ["Placeholder template fallback"],
    }),
  },
];

export function selectTemplate(spec) {
  const validated = validateGameSpec(spec);
  if (!validated.ok) {
    const placeholder = templates.find((t) => t.id === TemplateId.placeholder_basic);
    return placeholder;
  }
  const exact = templates.find((t) => t.type === spec.type && t.canHandle(spec));
  if (exact) return exact;
  return templates.find((t) => t.id === TemplateId.placeholder_basic);
}

export function getTemplates() {
  return templates.slice();
}
