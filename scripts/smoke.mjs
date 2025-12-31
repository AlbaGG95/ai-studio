#!/usr/bin/env node

import { interpretToSpec } from "../lib/specInterpreter.js";
import { selectTemplate } from "../lib/templates/registry.js";

const cases = [
  { name: "Idle RPG", title: "Dark Mythology", prompt: "Idle RPG AFK con heroes y progreso por stages." },
  { name: "Trivia", title: "Trivia Anime", prompt: "Juego de preguntas tipo quiz con categorías, tono casual." },
  { name: "Runner", title: "Neon Runner", prompt: "Endless runner con obstáculos y velocidad progresiva." },
  { name: "Tower Defense", title: "Citadel Siege", prompt: "Defensa de torres con oleadas de enemigos." },
  { name: "Match3", title: "Crystal Garden", prompt: "Puzzle match para combinar gemas y lograr objetivos." },
  { name: "Ambiguo", title: "Mi juego", prompt: "Quiero algo divertido con progreso." },
  { name: "Vacío", title: "", prompt: "" },
  { name: "Muy largo", title: "Mega Prompt", prompt: "endless ".repeat(700) },
];

let failures = 0;

for (const test of cases) {
  try {
    const spec = interpretToSpec(test.title, test.prompt);
    const template = selectTemplate(spec);
    const generated = template.build(spec);

    if (!template?.id) throw new Error("templateId vacío");
    if (!generated?.route || typeof generated.route !== "string") throw new Error("route inválida");
    if (!generated.config) throw new Error("config faltante");

    console.log(
      `[ok] ${test.name}: type=${spec.type} template=${template.id} route=${generated.route}`
    );
  } catch (err) {
    failures += 1;
    console.error(`[fail] ${test.name}: ${err instanceof Error ? err.message : String(err)}`);
  }
}

if (failures > 0) {
  process.exitCode = 1;
  console.error(`\nSmoke tests completed with ${failures} failure(s).`);
} else {
  console.log("\nSmoke tests passed.");
}
