import {
  Biome,
  Faction,
  GameSpec,
  GenerateGameParams,
  GenerateHeroParams,
  GenerateWorldParams,
  HeroClass,
  HeroSpec,
  LootItem,
  LootTable,
  Rarity,
  RegionSpec,
  SetBonus,
  WorldSpec,
} from "./types.js";

export type GenerateRequest = GenerateGameParams;

const version = "2.0.0";
const baseSeed = 2166136261;

export function hashStringToSeed(text: string): number {
  let hash = baseSeed;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function makeRng(seed: number) {
  let state = seed || 1;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

function pick<T>(rng: () => number, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

function range(count: number, start = 0): number[] {
  return Array.from({ length: count }, (_, i) => i + start);
}

const heroNames = {
  mage: ["Lyra", "Nilo", "Seraphine", "Vesper", "Celis", "Ilyon"],
  tank: ["Brann", "Kael", "Aurek", "Rurik", "Galwyr", "Thorin"],
  warrior: ["Alden", "Rhea", "Caelan", "Vorin", "Mara", "Edrin"],
  ranger: ["Ayla", "Luneth", "Silva", "Nyra", "Thale", "Rowan"],
  support: ["Melly", "Sova", "Iris", "Talya", "Fiora", "Zephy"],
};

const heroLoreFragments = [
  "Guarda secretos antiguos entre páginas luminosas.",
  "Defiende los reinos ocultos de la Biblioteca Eterna.",
  "Portador de un tomo que canta al amanecer.",
  "Teje destinos con tinta encantada.",
  "Camina entre ilustraciones vivientes.",
];

const factions: Faction[] = [
  "Lightbearer",
  "Mauler",
  "Wilder",
  "Graveborn",
  "Celestial",
  "Hypogean",
  "Dimensional",
];

const biomes: Biome[] = [
  "forest",
  "desert",
  "mountain",
  "swamp",
  "ruins",
  "ice",
  "volcanic",
  "coast",
];

const heroClassRole: Record<HeroClass, "tank" | "dps" | "support"> = {
  mage: "dps",
  tank: "tank",
  warrior: "dps",
  ranger: "dps",
  support: "support",
};

const rarityOrder: Rarity[] = [
  "common",
  "uncommon",
  "rare",
  "epic",
  "legendary",
];

function scaleByRarity(base: number, rarity: Rarity) {
  const index = rarityOrder.indexOf(rarity);
  return Math.round(base * (1 + index * 0.35));
}

function generateSkill(
  rng: () => number,
  nameHint: string,
  type: "passive" | "active" | "ultimate"
) {
  const verbs = ["Invoca", "Canaliza", "Desata", "Protege", "Amplifica"];
  const nouns = ["luz arcana", "escudos etéreos", "espíritus", "astros", "runas"];
  const effects = [
    "aumenta ATK",
    "cura en oleadas",
    "aplica daño en el tiempo",
    "concede velocidad",
    "reduce DEF enemiga",
  ];
  return {
    id: `${type}-${nameHint}-${Math.floor(rng() * 9999)}`,
    name: `${pick(rng, verbs)} ${pick(rng, nouns)}`,
    description: `${pick(rng, effects)} y potencia a los aliados de ${nameHint}.`,
    cooldown: type === "ultimate" ? 12 + Math.floor(rng() * 6) : 4 + Math.floor(rng() * 4),
    tags: [type, nameHint],
    type,
  };
}

export function generateHero(params: GenerateHeroParams): HeroSpec {
  const seed = params.seed ?? hashStringToSeed(`${params.class || "any"}|${params.faction || "any"}`);
  const rng = makeRng(seed);
  const cls = params.class ?? pick(rng, Object.keys(heroNames) as HeroClass[]);
  const faction = params.faction ?? pick(rng, factions);
  const rarity = params.rarity ?? pick(rng, rarityOrder);
  const name = pick(rng, heroNames[cls]);
  const roleHint = heroClassRole[cls];

  const baseHp = 800 + Math.floor(rng() * 400);
  const baseAtk = 80 + Math.floor(rng() * 40);
  const baseDef = 60 + Math.floor(rng() * 25);
  const baseSpd = 90 + Math.floor(rng() * 20);

  const stats = {
    hp: scaleByRarity(baseHp, rarity) + (roleHint === "tank" ? 200 : 0),
    atk: scaleByRarity(baseAtk, rarity) + (roleHint === "dps" ? 40 : 0),
    def: scaleByRarity(baseDef, rarity) + (roleHint === "tank" ? 30 : 0),
    spd: baseSpd + (roleHint === "support" ? 10 : 0),
    crit: 10 + Math.floor(rng() * 10) + (roleHint === "dps" ? 10 : 0),
    critDmg: 150 + Math.floor(rng() * 30),
  };

  return {
    id: `hero-${cls}-${faction}-${rarity}-${Math.floor(seed % 99999)}`,
    name: `${name} ${pick(rng, ["del Alba", "de las Runas", "del Eco", "del Velo", "del Relato"])}`,
    class: cls,
    faction,
    rarity,
    ascensionTier: rarityOrder.indexOf(rarity),
    roleHint,
    lore: `${pick(rng, heroLoreFragments)} ${pick(
      rng,
      heroLoreFragments
    )}`,
    stats,
    skills: {
      passives: [generateSkill(rng, name, "passive")],
      actives: [generateSkill(rng, name, "active"), generateSkill(rng, name, "active")],
      ultimate: generateSkill(rng, name, "ultimate"),
    },
  };
}

function generateEnemy(rng: () => number, nameSeed: string, level: number, isBoss = false) {
  const title = pick(rng, ["Guardia", "Sombra", "Bestia", "Titán", "Exiliado", "Cántico"]);
  const name = `${title} ${nameSeed}`;
  const hp = (isBoss ? 2000 : 1200) + level * 80;
  const atk = (isBoss ? 160 : 90) + level * 6;
  const def = (isBoss ? 120 : 60) + level * 4;

  return {
    id: `${isBoss ? "boss" : "enemy"}-${nameSeed}-${level}`,
    name,
    description: `${name} habita en las páginas del cuento mágico.`,
    faction: pick(rng, factions),
    isBoss,
    stats: {
      hp,
      atk,
      def,
      spd: 80 + Math.floor(rng() * 20),
    },
    lootTableRef: "default",
    xpRange: [40 + level * 3, 80 + level * 6] as [number, number],
    goldRange: [20 + level * 2, 50 + level * 4] as [number, number],
  };
}

function generateLootTables(rng: () => number): { lootTables: LootTable[]; sampleItems: LootItem[] } {
  const slots: LootItem["slot"][] = ["weapon", "armor", "trinket", "artifact"];
  const elements = ["Luz", "Tinta", "Eco", "Llama", "Niebla", "Bruma"];

  const lootTables: LootTable[] = [];
  const sampleItems: LootItem[] = [];

  for (const rarity of rarityOrder) {
    const tableItems: LootItem[] = range(4).map((i) => {
      const slot = pick(rng, slots);
      const name = `${rarity.toUpperCase()} ${pick(rng, elements)} ${slot}`;
      const item: LootItem = {
        id: `${rarity}-${slot}-${i}`,
        name,
        rarity,
        slot,
        stats: {
          atk: slot === "weapon" ? 12 + rarityOrder.indexOf(rarity) * 4 : undefined,
          def: slot === "armor" ? 10 + rarityOrder.indexOf(rarity) * 3 : undefined,
          hp: slot === "trinket" ? 90 + rarityOrder.indexOf(rarity) * 40 : undefined,
          spd: slot === "artifact" ? 6 + rarityOrder.indexOf(rarity) * 2 : undefined,
          crit: rarityOrder.indexOf(rarity) >= 2 ? 5 + rarityOrder.indexOf(rarity) * 2 : undefined,
        },
        tags: [slot, rarity],
      };
      sampleItems.push(item);
      return item;
    });

    lootTables.push({
      id: `${rarity}-table`,
      name: `Botín ${rarity}`,
      rarityWeights: {
        common: 50,
        uncommon: 30,
        rare: 15,
        epic: 4,
        legendary: 1,
      },
      items: tableItems,
    });
  }

  return { lootTables, sampleItems };
}

function generateSetBonuses(): SetBonus[] {
  return [
    {
      id: "storybook-2",
      name: "Relato Viviente (2)",
      description: "Incrementa ATK un 10% y velocidad en 5.",
      required: 2,
      bonus: "+10% ATK / +5 SPD",
    },
    {
      id: "storybook-4",
      name: "Relato Viviente (4)",
      description: "Regenera 3% de HP cada 5s y +10% daño mágico.",
      required: 4,
      bonus: "Regeneración y +10% daño mágico",
    },
  ];
}

export function generateWorld(params: GenerateWorldParams): WorldSpec {
  const seed = params.seed ?? hashStringToSeed(`${params.themePreset || "storybook"}|world`);
  const rng = makeRng(seed);
  const numRegions = Math.max(3, Math.min(10, params.numRegions ?? 6));

  const regions: RegionSpec[] = range(numRegions).map((idx) => {
    const biome = pick(rng, biomes);
    const levelStart = 1 + idx * 5;
    const levelEnd = levelStart + 4;
    const bossId = `boss-${biome}-${idx}`;
    const enemies = range(4).map((i) => `enemy-${biome}-${idx}-${i}`);

    return {
      id: `region-${idx + 1}`,
      name: `${pick(rng, ["Bosque", "Valle", "Ruinas", "Torre", "Mar"]) } ${pick(
        rng,
        ["Encantado", "Susurrante", "Ardiente", "Sombrío", "de Cristal"]
      )}`,
      biome,
      levelRange: [levelStart, levelEnd],
      enemyPool: enemies,
      bossRef: bossId,
      events: ["hallazgo de runas", "mercader efímero", "duelo amistoso"],
      puzzles: ["sigilos", "laberinto corto", "luces cambiantes"],
      fastTravelPoints: [`Portal ${idx + 1}`, `Nido ${idx + 1}`],
    };
  });

  return {
    id: `world-${seed.toString(36).slice(0, 6)}`,
    name: "Libro de Aventuras",
    description: "Un mundo ilustrado que reacciona a tus decisiones.",
    regions,
    meta: {
      createdAt: new Date().toISOString(),
      version,
      seed,
    },
  };
}

export function generateGameSpec(params: GenerateGameParams): GameSpec {
  const projectName = params.projectName?.trim() || "AFK Storybook";
  const description =
    params.description?.trim() || "Idle RPG procedimental, 100% offline.";
  const themePreset = params.themePreset || "magical-storybook";
  const seed = hashStringToSeed(`${projectName}|${description}|${themePreset}`);
  const rng = makeRng(seed);

  const heroes: HeroSpec[] = range(8).map((i) =>
    generateHero({
      seed: seed + i * 11,
      class: pick(rng, ["mage", "tank", "warrior", "ranger", "support"] as HeroClass[]),
      faction: pick(rng, factions),
      rarity: pick(rng, rarityOrder.slice(1)),
    })
  );

  const world = generateWorld({ seed: seed + 123, themePreset });

  const enemies = world.regions.flatMap((region, idx) =>
    region.enemyPool.map((enemyId, enemyIdx) =>
      generateEnemy(
        rng,
        `${region.biome}-${enemyIdx}`,
        region.levelRange[0] + enemyIdx,
        false
      )
    ).concat([
      generateEnemy(rng, `${region.biome}-boss-${idx}`, region.levelRange[1], true),
    ])
  );

  const { lootTables, sampleItems } = generateLootTables(rng);

  const difficultyCurve = range(20, 1).map((i) => 1 + i * 0.2);
  const xpCurve = range(20, 1).map((i) => Math.floor(100 * Math.pow(1.18, i)));

  const palette = ["#0b1024", "#111b3a", "#1f2e5c", "#65d1ff", "#b77bff"];
  const factionColors: Record<Faction, string> = {
    Lightbearer: "#f4d35e",
    Mauler: "#ef6c57",
    Wilder: "#65d1ff",
    Graveborn: "#c084fc",
    Celestial: "#fef08a",
    Hypogean: "#8b5cf6",
    Dimensional: "#22d3ee",
  };
  const biomeStyles: Record<Biome, string> = {
    forest: "#22c55e",
    desert: "#f59e0b",
    mountain: "#94a3b8",
    swamp: "#047857",
    ruins: "#6b7280",
    ice: "#7dd3fc",
    volcanic: "#fb7185",
    coast: "#38bdf8",
  };

  return {
    meta: {
      name: projectName,
      description,
      themePreset,
      createdAt: new Date().toISOString(),
      version,
      seed,
    },
    progression: {
      stage: 1,
      xpCurve,
      goldPerSec: 12,
      difficultyCurve,
      offlineCapMinutes: 240,
      tickMs: 1200,
    },
    roster: {
      heroes,
    },
    enemies,
    items: {
      lootTables,
      affixes: ["Velo", "Arcano", "Bestial", "Sigiloso", "Resonante"],
      setBonuses: generateSetBonuses(),
      sampleItems,
    },
    world,
    modes: {
      campaign: true,
      dailyTrials: true,
      arenaMock: true,
      towerMock: true,
    },
    uiHints: {
      palette,
      factionColors,
      biomeStyles,
      iconMap: {
        hp: "heart",
        atk: "sword",
        def: "shield",
        spd: "wind",
        crit: "spark",
        gold: "coin",
      },
    },
  };
}
