#!/usr/bin/env node

import { interpretToSpec } from "../lib/specInterpreter.js";
import { selectTemplate } from "../lib/templates/registry.js";

const cases = [
  { title: "Dark Mythology", prompt: "Idle RPG AFK con héroes, progreso por stages, tono oscuro y épico." },
  { title: "Trivia Anime", prompt: "Juego de preguntas tipo quiz con categorías, tono casual." },
  { title: "Neon Runner", prompt: "Endless runner con obstáculos, velocidad progresiva, estética neón." },
  { title: "Mi juego", prompt: "Quiero algo divertido con progreso" },
];

for (const c of cases) {
  const spec = interpretToSpec(c.title, c.prompt);
  const template = selectTemplate(spec);
  const generated = template.build(spec);
  console.log(`\n[${c.title}]`);
  console.log(` type=${spec.type} template=${template.id} route=${generated.route}`);
}
