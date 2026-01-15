# GameSpec: Contrato universal (v1.0)

Uso: describe cualquier juego generado a partir de plantillas con un formato único. Este spec no ejecuta lógica; define datos y expectativas mínimas.

## Estructura
```ts
version: "1.0";
title: string;
type: "idle_rpg" | "clicker" | "runner" | "tower_defense" | "trivia" | "platformer_simple" | "match3";
theme: { name: string; tone: "dark" | "light" | "epic" | "casual" };
rules: {
  objective: string;
  controls: string[];
  winCondition: string;
  loseCondition?: string;
};
content: {
  entities: any[];   // según el tipo (heroes, torres, preguntas, fichas…)
  levels?: any[];
  economy?: any;     // costos, recompensas, timers…
};
ui: { layout: "bottom_nav" | "sidebar" | "single_screen" };
```

## Ejemplos por tipo
- **idle_rpg**
  ```json
  {
    "version": "1.0",
    "title": "Legends Idle",
    "type": "idle_rpg",
    "theme": { "name": "Arcane Dusk", "tone": "epic" },
    "rules": {
      "objective": "Progresar por stages venciendo oleadas AFK",
      "controls": ["Tap Collect", "Upgrade hero", "Auto-battle"],
      "winCondition": "Derrotar al boss del capítulo",
      "loseCondition": "Todos los héroes caen"
    },
    "content": {
      "entities": [{ "id": "h1", "role": "fighter", "power": 30 }],
      "levels": [{ "id": "s1", "enemyPower": 25 }],
      "economy": { "currency": ["gold", "essence"] }
    },
    "ui": { "layout": "bottom_nav" }
  }
  ```

- **clicker**
  ```json
  {
    "version": "1.0",
    "title": "Factory Clicks",
    "type": "clicker",
    "theme": { "name": "Clean Neon", "tone": "light" },
    "rules": {
      "objective": "Generar recursos clickeando y automatizando",
      "controls": ["Click main node", "Buy generator", "Upgrade speed"],
      "winCondition": "Alcanzar meta de producción",
      "loseCondition": "N/A"
    },
    "content": {
      "entities": [{ "id": "gen1", "name": "Extractor", "rate": 1 }],
      "economy": { "currency": ["credits"], "upgrades": ["speed", "multiplier"] }
    },
    "ui": { "layout": "single_screen" }
  }
  ```

- **tower_defense**
  ```json
  {
    "version": "1.0",
    "title": "Skyline TD",
    "type": "tower_defense",
    "theme": { "name": "Night Grid", "tone": "dark" },
    "rules": {
      "objective": "Defender el núcleo construyendo torres",
      "controls": ["Place tower", "Upgrade tower", "Start wave"],
      "winCondition": "Todas las oleadas completadas",
      "loseCondition": "Núcleo sin vidas"
    },
    "content": {
      "entities": [{ "id": "t1", "kind": "laser", "dps": 12 }],
      "levels": [{ "id": "map1", "paths": 2, "waves": 10 }],
      "economy": { "currency": "energy", "costs": { "t1": 20 } }
    },
    "ui": { "layout": "sidebar" }
  }
  ```

- **trivia**
  ```json
  {
    "version": "1.0",
    "title": "Quiz Rush",
    "type": "trivia",
    "theme": { "name": "Bright Cards", "tone": "casual" },
    "rules": {
      "objective": "Responder preguntas rápido",
      "controls": ["Tap opción", "Skip", "Timer"],
      "winCondition": "Racha de aciertos/meta de puntos",
      "loseCondition": "Se acaba el tiempo"
    },
    "content": {
      "entities": [{ "q": "Capital de Francia", "a": ["París", "Lyon"] }],
      "levels": [{ "timer": 30 }]
    },
    "ui": { "layout": "single_screen" }
  }
  ```

- **match3** (referencia breve)
  ```json
  {
    "version": "1.0",
    "title": "Gem Merge",
    "type": "match3",
    "theme": { "name": "Candy Grid", "tone": "casual" },
    "rules": {
      "objective": "Alinear 3 o más piezas",
      "controls": ["Swap adyacentes", "Usar power-up"],
      "winCondition": "Meta de puntos o limpiar tablero"
    },
    "content": {
      "entities": ["gem_red", "gem_blue", "gem_green"],
      "levels": [{ "moves": 20, "goal": 5000 }]
    },
    "ui": { "layout": "single_screen" }
  }
  ```
