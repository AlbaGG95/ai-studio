# AFK visual + asset pipeline

This slice keeps the combat engine untouched and layers a visual stack on top of the existing `/afk` routes.

## Procedural graphics
- Module: `apps/web/src/lib/afkProcedural.ts`
- Hero art: `buildHeroArtProfile` derives layered palettes and shapes from hero `visualSeed`, `role`, and `rarity`. The profile feeds the SVG portrait renderer and the Phaser texture builder so every hero stays deterministic.
- Icons: `generateIcon(seed, role?)` creates consistent gem-style icons for skills/items/buffs. `ProceduralIcon` renders them as SVG.
- Skills/items: `buildSkillset(hero)` generates names, descriptions, and matching icons per hero. `seedInventory(stage)` fabricates biome-themed loot for the Inventory screen.
- Biomes: `biomeForStage(stage)` returns palette/props used by the battle renderer and campaign map backgrounds.

## Battle renderer
- Component: `apps/web/src/app/afk/components/PhaserBattle.tsx`
- Responsibilities: 2.5D lane layout, idle/attack/hit/death tweens, HP/energy bars, floating numbers, and biome-aware backdrop.
- Data flow: consumes `RenderUnit` snapshots plus `lastEvent` from the combat summary; never mutates or influences combat logic. Simulation stops when the React controller finishes replaying events.
- Textures: hero textures are generated once per unit from `HeroArtProfile` (no external assets).

## Campaign map
- Component: `apps/web/src/app/afk/components/CampaignMap.tsx`
- A scrollable/pannable SVG world map with stage nodes (locked/available/cleared), enemy power, and reward hints. Clicking a node selects and opens `/afk/battle`.

## UI routes
- `/afk`: campaign map + stage timeline.
- `/afk/battle`: Phaser renderer with x1/x2 toggle, auto always on, overlay for win/loss/timeout, and reward preview.
- `/afk/heroes`: roster grid, formations, portrait gallery, and hero detail with procedural skills/icons.
- `/afk/idle`: idle rewards chest with animated progress and claim CTA.
- `/afk/inventory`: biome-driven loot presentation; visual only.

## Notes
- Everything runs offline by default; no external art is fetched.
- Optional AI image generation is not enabled; any future hook should be additive and cached, never blocking gameplay.
