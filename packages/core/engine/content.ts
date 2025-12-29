import { EnemyTemplate, Item, Rarity, StageDefinition, UnitTemplate } from "./types.js";

const baseAbility = (id: string, name: string, powerMultiplier: number) => ({
  id,
  name,
  description: name,
  powerMultiplier,
});

export const HEROES: UnitTemplate[] = [
  {
    id: "auren",
    name: "Auren la Muralla",
    role: "tank",
    faction: "lightbearer",
    rarity: "epic",
    position: "front",
    baseStats: { hp: 2100, atk: 120, def: 110, crit: 5 },
    abilities: {
      basic: { ...baseAbility("auren-basic", "Embate protector", 1.0), type: "basic", target: "enemy" },
      ultimate: {
        ...baseAbility("auren-ult", "Fortaleza viva", 1.6),
        type: "ultimate",
        target: "enemy",
        description: "Golpe en área con escudo aumentado",
      },
    },
  },
  {
    id: "nyra",
    name: "Nyra Flechana",
    role: "ranger",
    faction: "wilder",
    rarity: "epic",
    position: "back",
    baseStats: { hp: 1500, atk: 180, def: 70, crit: 15 },
    abilities: {
      basic: { ...baseAbility("nyra-basic", "Descarga veloz", 1.1), type: "basic", target: "enemy" },
      ultimate: {
        ...baseAbility("nyra-ult", "Lluvia de flechas", 1.8),
        type: "ultimate",
        target: "enemy",
        description: "Daño múltiple en la backline",
      },
    },
  },
  {
    id: "talya",
    name: "Talya de Luz",
    role: "support",
    faction: "celestial",
    rarity: "epic",
    position: "back",
    baseStats: { hp: 1600, atk: 130, def: 80, crit: 8 },
    abilities: {
      basic: { ...baseAbility("talya-basic", "Luz guía", 0.9), type: "basic", target: "enemy" },
      ultimate: {
        ...baseAbility("talya-ult", "Eco sanador", 1.2),
        type: "ultimate",
        target: "ally",
        description: "Sana al aliado más herido",
      },
    },
  },
  {
    id: "vorin",
    name: "Vorin de Bronce",
    role: "fighter",
    faction: "mauler",
    rarity: "rare",
    position: "front",
    baseStats: { hp: 1800, atk: 155, def: 90, crit: 10 },
    abilities: {
      basic: { ...baseAbility("vorin-basic", "Corte pesado", 1.05), type: "basic", target: "enemy" },
      ultimate: {
        ...baseAbility("vorin-ult", "Grito de guerra", 1.5),
        type: "ultimate",
        target: "enemy",
        description: "Golpe crítico garantizado",
      },
    },
  },
  {
    id: "sylva",
    name: "Sylva Umbría",
    role: "mage",
    faction: "hypogean",
    rarity: "epic",
    position: "back",
    baseStats: { hp: 1400, atk: 190, def: 65, crit: 12 },
    abilities: {
      basic: { ...baseAbility("sylva-basic", "Orbe sombrío", 1.15), type: "basic", target: "enemy" },
      ultimate: {
        ...baseAbility("sylva-ult", "Tempestad arcana", 1.85),
        type: "ultimate",
        target: "enemy",
        description: "Daño en área con reducción de DEF",
      },
    },
  },
];

export const ENEMIES: EnemyTemplate[] = [
  {
    id: "brute",
    name: "Bruto Cieno",
    kind: "normal",
    role: "tank",
    faction: "mauler",
    rarity: "common",
    position: "front",
    baseStats: { hp: 1500, atk: 110, def: 70 },
    rewardMultiplier: 1,
    abilities: {
      basic: { ...baseAbility("brute-basic", "Golpe pesado", 1.0), type: "basic", target: "enemy" },
      ultimate: { ...baseAbility("brute-ult", "Aplastamiento", 1.4), type: "ultimate", target: "enemy" },
    },
  },
  {
    id: "stalker",
    name: "Acechador Sombrío",
    kind: "elite",
    role: "ranger",
    faction: "hypogean",
    rarity: "rare",
    position: "back",
    baseStats: { hp: 1200, atk: 170, def: 60 },
    rewardMultiplier: 1.3,
    abilities: {
      basic: { ...baseAbility("stalker-basic", "Disparo preciso", 1.1), type: "basic", target: "enemy" },
      ultimate: { ...baseAbility("stalker-ult", "Marca letal", 1.6), type: "ultimate", target: "enemy" },
    },
  },
  {
    id: "warlock",
    name: "Brujo Ocaso",
    kind: "elite",
    role: "mage",
    faction: "hypogean",
    rarity: "rare",
    position: "back",
    baseStats: { hp: 1300, atk: 165, def: 65 },
    rewardMultiplier: 1.25,
    abilities: {
      basic: { ...baseAbility("warlock-basic", "Descarga oscura", 1.1), type: "basic", target: "enemy" },
      ultimate: { ...baseAbility("warlock-ult", "Ruptura ígnea", 1.7), type: "ultimate", target: "enemy" },
    },
  },
  {
    id: "warden",
    name: "Guardián Risco",
    kind: "boss",
    role: "tank",
    faction: "celestial",
    rarity: "legendary",
    position: "front",
    baseStats: { hp: 2400, atk: 160, def: 120 },
    rewardMultiplier: 2,
    abilities: {
      basic: { ...baseAbility("warden-basic", "Martillo sagrado", 1.05), type: "basic", target: "enemy" },
      ultimate: { ...baseAbility("warden-ult", "Juicio celeste", 1.9), type: "ultimate", target: "enemy" },
    },
  },
  {
    id: "assassin",
    name: "Asesino Espiral",
    kind: "normal",
    role: "fighter",
    faction: "dimensional",
    rarity: "rare",
    position: "back",
    baseStats: { hp: 1100, atk: 175, def: 55 },
    rewardMultiplier: 1.15,
    abilities: {
      basic: { ...baseAbility("assassin-basic", "Estoque veloz", 1.05), type: "basic", target: "enemy" },
      ultimate: { ...baseAbility("assassin-ult", "Danza de cuchillas", 1.6), type: "ultimate", target: "enemy" },
    },
  },
];

export const ITEMS: Item[] = [
  { id: "blade-common", name: "Hoja Oxidada", rarity: "common", stats: { atk: 8 } },
  { id: "armor-common", name: "Peto Ligero", rarity: "common", stats: { def: 6 } },
  { id: "blade-rare", name: "Filo Arcanizado", rarity: "rare", stats: { atk: 14, crit: 5 } },
  { id: "ring-epic", name: "Anillo del Eco", rarity: "epic", stats: { atk: 10, hp: 120, crit: 6 } },
  { id: "aegis-legendary", name: "Égida de la Aurora", rarity: "legendary", stats: { def: 18, hp: 160 } },
];

export const STAGES: StageDefinition[] = [
  {
    id: "1-1",
    name: "Sendero Susurrante",
    level: 1,
    enemyLineup: ["brute", "brute", "stalker", "warlock", "assassin"],
    reward: { gold: 60, xp: 25 },
  },
  {
    id: "1-2",
    name: "Costa Umbría",
    level: 2,
    enemyLineup: ["brute", "warden", "stalker", "warlock", "assassin"],
    reward: { gold: 75, xp: 28 },
  },
  {
    id: "1-3",
    name: "Bastión Eterno",
    level: 3,
    enemyLineup: ["warden", "brute", "stalker", "warlock", "assassin"],
    reward: { gold: 90, xp: 30 },
  },
];

export const RARITY_ORDER: Rarity[] = ["common", "rare", "epic", "legendary"];
