import { GameSpec, GameType, ThemeTone, UiLayout, validateGameSpec } from "./gameSpec";

type KeywordMap = {
  type: GameType;
  keywords: string[];
};

const KEYWORD_TABLE: KeywordMap[] = [
  { type: "runner", keywords: ["correr", "obstáculo", "obstaculo", "endless", "runner"] },
  { type: "tower_defense", keywords: ["torres", "olas", "defensa", "enemigos", "tower"] },
  { type: "trivia", keywords: ["preguntas", "quiz", "trivia"] },
  { type: "clicker", keywords: ["clic", "click", "tap", "incremental"] },
  { type: "match3", keywords: ["puzzle", "combinar", "match"] },
  { type: "platformer_simple", keywords: ["saltos", "plataformas", "platformer"] },
  { type: "idle_rpg", keywords: ["idle", "afk", "héroes", "heroes", "equipos", "party"] },
];

const DEFAULT_THEME: ThemeTone = "casual";
const DEFAULT_LAYOUT: UiLayout = "single_screen";

export function interpretToSpec(title: string, prompt: string): GameSpec {
  const normalized = `${title} ${prompt}`.toLowerCase();
  const type = detectType(normalized);
  const tone = detectTone(normalized);
  const layout = detectLayout(normalized);

  const spec: GameSpec = {
    version: "1.0",
    title: title.trim() || "Untitled Game",
    type,
    theme: {
      name: detectThemeName(title, prompt),
      tone,
    },
    rules: buildRules(type, normalized),
    content: buildContent(type, normalized),
    ui: { layout },
  };

  const validation = validateGameSpec(spec);
  if (!validation.ok) {
    // As a safety net, return a minimal idle RPG spec if validation fails.
    return fallbackSpec(title || "Untitled Game");
  }
  return spec;
}

function detectType(text: string): GameType {
  for (const entry of KEYWORD_TABLE) {
    if (entry.keywords.some((kw) => text.includes(kw))) {
      return entry.type;
    }
  }
  return "idle_rpg";
}

function detectTone(text: string): ThemeTone {
  if (text.includes("oscuro") || text.includes("dark")) return "dark";
  if (text.includes("epic") || text.includes("épico") || text.includes("epico")) return "epic";
  if (text.includes("casual")) return "casual";
  if (text.includes("light") || text.includes("claro")) return "light";
  return DEFAULT_THEME;
}

function detectLayout(text: string): UiLayout {
  if (text.includes("sidebar")) return "sidebar";
  if (text.includes("barra inferior") || text.includes("bottom")) return "bottom_nav";
  return DEFAULT_LAYOUT;
}

function detectThemeName(title: string, prompt: string): string {
  const name = title.trim() || prompt.split(".")[0].slice(0, 40);
  return name || "Generic Theme";
}

function buildRules(type: GameType, text: string): GameSpec["rules"] {
  const baseControls: Record<GameType, string[]> = {
    idle_rpg: ["Auto-battle", "Upgrade heroes", "Claim idle"],
    clicker: ["Tap main node", "Buy upgrade"],
    runner: ["Tap jump", "Swipe move", "Dodge obstacles"],
    tower_defense: ["Place tower", "Upgrade tower", "Start wave"],
    trivia: ["Tap answer", "Skip question"],
    platformer_simple: ["Move left/right", "Jump"],
    match3: ["Swap tiles", "Trigger power-ups"],
  };
  const objectives: Record<GameType, string> = {
    idle_rpg: "Progresar por stages venciendo oleadas",
    clicker: "Incrementar recursos y automatizar producción",
    runner: "Correr lo más lejos evitando obstáculos",
    tower_defense: "Defender el núcleo de oleadas enemigas",
    trivia: "Responder preguntas correctamente",
    platformer_simple: "Llegar al final del nivel saltando obstáculos",
    match3: "Combinar piezas para alcanzar la meta de puntos",
  };
  const wins: Record<GameType, string> = {
    idle_rpg: "Derrotar al boss del capítulo",
    clicker: "Alcanzar meta de producción",
    runner: "Lograr distancia objetivo o récord",
    tower_defense: "Completar todas las oleadas",
    trivia: "Alcanzar la puntuación meta",
    platformer_simple: "Cruzar la meta del nivel",
    match3: "Completar objetivo antes de agotar movimientos",
  };
  const loses: Partial<Record<GameType, string>> = {
    idle_rpg: "Todos los héroes caen",
    runner: "Colisionar con obstáculo",
    tower_defense: "Núcleo sin vidas",
    trivia: "Se acaba el tiempo o intentos",
    platformer_simple: "Caer fuera de plataforma o sin vidas",
  };
  return {
    objective: objectives[type],
    controls: baseControls[type],
    winCondition: wins[type],
    loseCondition: loses[type],
  };
}

function buildContent(type: GameType, text: string): GameSpec["content"] {
  switch (type) {
    case "idle_rpg":
      return {
        entities: [{ id: "hero-1", role: "fighter", power: 10 }],
        levels: [{ id: "stage-1", enemyPower: 8 }],
        economy: { currency: ["gold", "essence"] },
      };
    case "clicker":
      return {
        entities: [{ id: "gen-1", name: "Generator", rate: 1 }],
        economy: { currency: ["credits"], upgrades: ["rate", "multiplier"] },
      };
    case "runner":
      return {
        entities: [{ id: "runner-1", speed: 1 }],
        levels: [{ id: "track-1", obstacles: 10 }],
      };
    case "tower_defense":
      return {
        entities: [{ id: "tower-1", kind: "cannon", dps: 5 }],
        levels: [{ id: "map-1", waves: 10 }],
        economy: { currency: "energy" },
      };
    case "trivia":
      return {
        entities: [{ q: "Pregunta ejemplo", a: ["Opción A", "Opción B"] }],
        levels: [{ timer: 30 }],
      };
    case "platformer_simple":
      return {
        entities: [{ id: "player", abilities: ["jump"] }],
        levels: [{ id: "level-1", platforms: 12 }],
      };
    case "match3":
      return {
        entities: ["gem_red", "gem_blue", "gem_green"],
        levels: [{ moves: 20, goal: 5000 }],
      };
    default:
      return { entities: [] };
  }
}

function fallbackSpec(title: string): GameSpec {
  return {
    version: "1.0",
    title: title || "Untitled Game",
    type: "idle_rpg",
    theme: { name: "Default Idle", tone: DEFAULT_THEME },
    rules: buildRules("idle_rpg", ""),
    content: buildContent("idle_rpg", ""),
    ui: { layout: DEFAULT_LAYOUT },
  };
}
