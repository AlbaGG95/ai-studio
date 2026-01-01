import { GameSpec, GameType, validateGameSpec } from "../gameSpec";

export enum TemplateId {
  idle_rpg_afk = "idle_rpg_afk",
  clicker_basic = "clicker_basic",
  runner_endless = "runner_endless",
  tower_defense_basic = "tower_defense_basic",
  trivia_basic = "trivia_basic",
  match3_basic = "match3_basic",
  platformer_basic = "platformer_basic",
  placeholder_basic = "placeholder_basic",
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

export type TriviaQuestionShape = {
  id: string;
  prompt: string;
  options: string[];
  answerIndex: number;
};

const TRIVIA_FALLBACK_OPTIONS = ["Opción A", "Opción B", "Opción C", "Opción D"];

export function normalizeTriviaQuestions(raw: any, title = "Trivia"): TriviaQuestionShape[] {
  const source = Array.isArray(raw) && raw.length > 0 ? raw : [{ prompt: `${title || "Pregunta"} 1` }];
  return source.map((entry: any, idx: number) => {
    const prompt =
      (typeof entry?.prompt === "string" && entry.prompt.trim()) ||
      (typeof entry?.question === "string" && entry.question.trim()) ||
      (typeof entry?.q === "string" && entry.q.trim()) ||
      (typeof entry === "string" && entry.trim()) ||
      `${title || "Pregunta"} ${idx + 1}`;
    const options = normalizeTriviaOptions(entry, prompt);
    const answerIndex = clampAnswerIndex(entry, options);
    const id = (typeof entry?.id === "string" && entry.id.trim()) || `q-${idx + 1}`;
    return { id, prompt, options, answerIndex };
  });
}

function normalizeTriviaOptions(entry: any, prompt: string): string[] {
  const source =
    (Array.isArray(entry?.options) && entry.options) ||
    (Array.isArray(entry?.a) && entry.a) ||
    (Array.isArray(entry?.answers) && entry.answers) ||
    [];
  const mapped =
    source.length > 0
      ? source
          .map((opt: any, idx: number) =>
            typeof opt === "string" && opt.trim() ? opt.trim() : `Opción ${String.fromCharCode(65 + idx)}`
          )
          .filter(Boolean)
      : [];
  const fallback = buildFallbackTriviaOptions(prompt);
  const options = mapped.slice(0, 4);
  while (options.length < 4) {
    options.push(fallback[options.length] || fallback[0]);
  }
  return options.slice(0, 4);
}

function clampAnswerIndex(entry: any, options: string[]): number {
  const candidate =
    typeof entry?.answerIndex === "number"
      ? entry.answerIndex
      : typeof entry?.correctIndex === "number"
      ? entry.correctIndex
      : typeof entry?.correct === "number"
      ? entry.correct
      : typeof entry?.answer === "string"
      ? options.findIndex((opt) => opt.toLowerCase() === entry.answer.toLowerCase())
      : 0;
  const safe = Number.isFinite(candidate) ? candidate : 0;
  const max = Math.max(options.length - 1, 0);
  return Math.min(Math.max(safe, 0), max);
}

function buildFallbackTriviaOptions(prompt: string): string[] {
  const base = prompt?.trim();
  if (!base) return [...TRIVIA_FALLBACK_OPTIONS];
  return TRIVIA_FALLBACK_OPTIONS.map((opt) => `${base} - ${opt}`);
}

const templates: GameTemplate[] = [
  {
    id: TemplateId.idle_rpg_afk,
    type: "idle_rpg",
    canHandle: (spec) => spec.type === "idle_rpg",
    build: (spec) => {
      const configId = pickAfkConfigId(spec);
      return {
        route: `/afk?configId=${configId}`,
        config: {
          title: spec.title,
          theme: spec.theme,
          rules: spec.rules,
          content: spec.content,
          configId,
        },
        notes: ["AFK/idle RPG base template"],
      };
    },
  },
  {
    id: TemplateId.clicker_basic,
    type: "clicker",
    canHandle: (spec) => spec.type === "clicker",
    build: (spec) => ({
      route: `/play?templateId=${TemplateId.clicker_basic}&title=${encodeURIComponent(spec.title)}`,
      config: { title: spec.title, content: spec.content },
      notes: ["Clicker basic template"],
    }),
  },
  {
    id: TemplateId.runner_endless,
    type: "runner",
    canHandle: (spec) => spec.type === "runner",
    build: (spec) => ({
      route: `/play?templateId=${TemplateId.runner_endless}&title=${encodeURIComponent(spec.title)}`,
      config: {
        title: spec.title,
        content: spec.content,
        theme: spec.theme,
        rules: spec.rules,
      },
      notes: ["Endless runner template"],
    }),
  },
  {
    id: TemplateId.tower_defense_basic,
    type: "tower_defense",
    canHandle: (spec) => spec.type === "tower_defense",
    build: (spec) => ({
      route: `/play?templateId=${TemplateId.tower_defense_basic}&title=${encodeURIComponent(spec.title)}`,
      config: {
        title: spec.title,
        content: spec.content,
        theme: spec.theme,
        rules: spec.rules,
      },
      notes: ["Tower defense basic template"],
    }),
  },
  {
    id: TemplateId.trivia_basic,
    type: "trivia",
    canHandle: (spec) => spec.type === "trivia",
    build: (spec) => {
      const questions = normalizeTriviaQuestions(spec.content?.entities, spec.title);
      const content = { ...spec.content, entities: questions };
      return {
        route: "/play?templateId=trivia_basic",
        config: { title: spec.title, content, questions },
        notes: ["Trivia basic template"],
      };
    },
  },
  {
    id: TemplateId.match3_basic,
    type: "match3",
    canHandle: (spec) => spec.type === "match3",
    build: (spec) => ({
      route: `/play?templateId=${TemplateId.match3_basic}&title=${encodeURIComponent(spec.title)}`,
      config: { title: spec.title, content: spec.content },
      notes: ["Match3 basic template"],
    }),
  },
  {
    id: TemplateId.platformer_basic,
    type: "platformer_simple",
    canHandle: (spec) => spec.type === "platformer_simple",
    build: (spec) => ({
      route: `/play?templateId=${TemplateId.platformer_basic}&title=${encodeURIComponent(spec.title)}`,
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

export function selectTemplate(spec: GameSpec): GameTemplate {
  const validation = validateGameSpec(spec);
  if (!validation.ok) {
    const placeholder = templates.find((t) => t.id === TemplateId.placeholder_basic)!;
    return placeholder;
  }
  const exact = templates.find((t) => t.type === spec.type && t.canHandle(spec));
  if (exact) return exact;
  const fallback = templates.find((t) => t.id === TemplateId.placeholder_basic)!;
  return fallback;
}

export function getTemplates() {
  return templates.slice();
}

function pickAfkConfigId(spec: GameSpec): string {
  const tone = spec.theme?.tone || "casual";
  if (tone === "dark" || tone === "epic") return "fantasy_dark";
  return "scifi_clean";
}
