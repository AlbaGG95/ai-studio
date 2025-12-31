import { GameSpec, GameType } from "../gameSpec";

export enum TemplateId {
  idle_rpg_afk = "idle_rpg_afk",
  clicker_basic = "clicker_basic",
  runner_endless = "runner_endless",
  tower_defense_basic = "tower_defense_basic",
  trivia_basic = "trivia_basic",
  match3_basic = "match3_basic",
  platformer_basic = "platformer_basic",
}

export interface GeneratedGame {
  route: string;
  config: any;
  assets?: any;
  notes?: string[];
}

export interface GameTemplate {
  id: TemplateId;
  type: GameType;
  canHandle: (spec: GameSpec) => boolean;
  build: (spec: GameSpec) => GeneratedGame;
}

const templates: GameTemplate[] = [
  {
    id: TemplateId.idle_rpg_afk,
    type: "idle_rpg",
    canHandle: (spec) => spec.type === "idle_rpg",
    build: (spec) => ({
      route: "/afk",
      config: {
        title: spec.title,
        theme: spec.theme,
        rules: spec.rules,
        content: spec.content,
      },
      notes: ["AFK/idle RPG base template"],
    }),
  },
  {
    id: TemplateId.clicker_basic,
    type: "clicker",
    canHandle: (spec) => spec.type === "clicker",
    build: (spec) => ({
      route: "/play?template=clicker_basic",
      config: { title: spec.title, content: spec.content },
      notes: ["Clicker basic template"],
    }),
  },
  {
    id: TemplateId.runner_endless,
    type: "runner",
    canHandle: (spec) => spec.type === "runner",
    build: (spec) => ({
      route: "/play?template=runner_endless",
      config: { title: spec.title, content: spec.content },
      notes: ["Endless runner template"],
    }),
  },
  {
    id: TemplateId.tower_defense_basic,
    type: "tower_defense",
    canHandle: (spec) => spec.type === "tower_defense",
    build: (spec) => ({
      route: "/play?template=td_basic",
      config: { title: spec.title, content: spec.content },
      notes: ["Tower defense basic template"],
    }),
  },
  {
    id: TemplateId.trivia_basic,
    type: "trivia",
    canHandle: (spec) => spec.type === "trivia",
    build: (spec) => ({
      route: "/play?template=trivia_basic",
      config: { title: spec.title, content: spec.content },
      notes: ["Trivia basic template"],
    }),
  },
  {
    id: TemplateId.match3_basic,
    type: "match3",
    canHandle: (spec) => spec.type === "match3",
    build: (spec) => ({
      route: "/play?template=match3_basic",
      config: { title: spec.title, content: spec.content },
      notes: ["Match3 basic template"],
    }),
  },
  {
    id: TemplateId.platformer_basic,
    type: "platformer_simple",
    canHandle: (spec) => spec.type === "platformer_simple",
    build: (spec) => ({
      route: "/play?template=platformer_basic",
      config: { title: spec.title, content: spec.content },
      notes: ["Platformer simple template"],
    }),
  },
];

export function selectTemplate(spec: GameSpec): GameTemplate {
  const exact = templates.find((t) => t.type === spec.type && t.canHandle(spec));
  if (exact) return exact;
  const fallback = templates.find((t) => t.type === "idle_rpg")!;
  return fallback;
}

export function getTemplates() {
  return templates.slice();
}
