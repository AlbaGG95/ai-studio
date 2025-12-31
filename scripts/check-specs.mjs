#!/usr/bin/env node

import { interpretToSpec } from "../lib/specInterpreter.js";

const samples = [
  ["Heroes AFK", "idle heroes afk campaña"],
  ["Torre Infinita", "defensa con torres y olas de enemigos"],
  ["Quiz rápido", "preguntas de trivia relámpago"],
  ["Runner urbano", "correr esquivando obstáculos endless"],
  ["Miner Tap", "click para producir y upgrades incremental"],
  ["Gemas", "puzzle match para combinar"],
  ["Saltitos", "plataformas simples con saltos"],
  ["Generic", "sin contexto"],
  ["Dungeon Crawl", "AFK dungeon idle equipos"],
  ["Galaxy TD", "defensa de base con torres laser"],
];

for (const [title, prompt] of samples) {
  const spec = interpretToSpec(title, prompt);
  console.log(`\n=== ${title} ===`);
  console.log(`type: ${spec.type}, tone: ${spec.theme.tone}, layout: ${spec.ui.layout}`);
  console.log(`objective: ${spec.rules.objective}`);
}
