# AFK / Idle RPG – Delivery Contract

## A) Game loop (online y offline)
- **Tick de recursos**: cada intervalo fijo (p.ej. 1s lógico) genera `gold` y `essence` en función de `stage` y multiplicadores de upgrades. No depende de la UI.
- **Progreso de stage**: el jugador acumula `stageProgress` por tick; al alcanzar el umbral se lanza un auto-combat de resolución rápida contra el stage actual.
- **Auto-combat simulado**: combate determinista con RNG inyectable; se calculan rondas hasta que uno de los lados cae o se supera un límite de turnos. Retorna `result`, `turns`, `damageLog` compacto.
- **Recompensas + feedback**: tras cada combate exitoso se otorgan `Reward` (recursos + drop chance). Al reclamar AFK/online se devuelve un resumen (oro, esencia, shards, items opcionales).
- **Offline/idle**: si el jugador vuelve después de `Δt`, se computan ticks acumulados hasta un cap horario, se simulan combats necesarios y se acumulan recompensas pendientes.
- **Unlocks por milestones**: ciertos hits de stage/tiempo desbloquean nuevas pestañas (Heroes/Upgrades/Settings) y multiplicadores (auto-speed, drop rate).

## B) UI layout obligatorio (estructura mínima)
- **Home/Dashboard**: snapshot de recursos actuales, progreso de stage, CTA para reclamar AFK.
- **Heroes**: lista + detalle de héroe, stats, equip/upgrade simple.
- **Battle/Stages**: vista del stage activo, barra de progreso, botón de “Auto-play” (ya es la default) y feedback de resultado.
- **Upgrades**: mejoras persistentes (producción, daño, cap offline).
- **Settings**: idioma, reset duro/suave, data export/import.
- **Navegación persistente**: reutilizar patrón actual (layout Next app). Puede ser bottom nav en móvil o sidebar sticky en desktop; siempre visible.

## C) Datos mínimos (modelos)
- **Hero**: `id`, `name`, `level`, `power`, `role`, `rarity`, `skills?`, `equipmentScore?`.
- **PlayerState**: `resources { gold, essence }`, `heroes: Hero[]`, `activeHeroIds`, `stage: Stage`, `unlocks`, `upgrades`, `lastTickAt`, `afkBank`.
- **Stage**: `id`, `index`, `enemyPower`, `reward: Reward`, `progress` (0..1), `milestone?: boolean`.
- **Reward**: `gold`, `essence`, `items?`, `shards?`, `multiplier?`.
- **Upgrade**: `id`, `name`, `level`, `cost`, `effect` (multipliers/bonos), `cap?`, `unlocked`.

## D) Principio de separación
- Toda la lógica vive en `/core` (módulos puros: loop, combate, progresión, economía). Ninguna dependencia de React/Next/DOM.
- La UI en `/apps/web` consume el contrato de `/core` (tipos y funciones) sin mutar estado interno; el estado se trata como datos serializables.
