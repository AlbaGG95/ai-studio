import { GameSpec, HeroSpec, LootItem } from "./types.js";

export interface GeneratedFile {
  path: string;
  content: string;
}

export interface GeneratedProject {
  files: GeneratedFile[];
}

function buildPortraitSvg(hero: HeroSpec, seed: number) {
  const colors = ["#6EE7B7", "#A78BFA", "#F472B6", "#60A5FA", "#FCD34D"];
  const accents = ["#0EA5E9", "#A855F7", "#F97316", "#22C55E", "#F43F5E"];
  const base = colors[seed % colors.length];
  const accent = accents[seed % accents.length];
  const shapes = [
    `<circle cx="50" cy="50" r="46" fill="${base}" opacity="0.18" />`,
    `<rect x="18" y="18" width="64" height="64" rx="16" fill="${accent}" opacity="0.14" />`,
    `<polygon points="50,6 78,26 70,82 50,94 30,82 22,26" fill="${accent}" opacity="0.2" />`,
  ];

  return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${hero.name}">
    <defs>
      <linearGradient id="grad-${hero.id}" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${base}" stop-opacity="0.9"/>
        <stop offset="100%" stop-color="${accent}" stop-opacity="0.9"/>
      </linearGradient>
    </defs>
    <rect x="6" y="6" width="88" height="88" rx="20" fill="url(#grad-${hero.id})" opacity="0.32"/>
    ${shapes.join("")}
    <circle cx="50" cy="38" r="18" fill="${base}" opacity="0.6" />
    <rect x="32" y="50" width="36" height="26" rx="12" fill="${accent}" opacity="0.4" />
    <text x="50" y="58" text-anchor="middle" fill="#fff" font-size="12" font-family="Inter, system-ui" opacity="0.9">${hero.class.toUpperCase()}</text>
  </svg>`;
}

function buildGameJson(spec: GameSpec): string {
  return JSON.stringify(spec, null, 2);
}

function buildIndexHtml(spec: GameSpec): string {
  const title = spec.meta.name || "Idle RPG";
  const description = spec.meta.description || "Idle RPG auto-generado";

  const palette = spec.uiHints.palette.join(", ");

  return `<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
    <style>
      :root {
        --bg: #0b1024;
        --panel: #0f172a;
        --card: #111c33;
        --border: rgba(255, 255, 255, 0.06);
        --accent: #65d1ff;
        --accent-2: #b77bff;
        --text: #e5e7eb;
        --muted: #9ca3af;
        --glow: 0 20px 80px rgba(101, 209, 255, 0.18);
        --palette: ${palette};
      }

      * { box-sizing: border-box; }

      body {
        margin: 0;
        font-family: "Inter", "Space Grotesk", system-ui, -apple-system, sans-serif;
        background: radial-gradient(circle at 12% 20%, rgba(101, 209, 255, 0.12), transparent 30%),
          radial-gradient(circle at 85% 18%, rgba(183, 123, 255, 0.1), transparent 28%),
          var(--bg);
        color: var(--text);
        min-height: 100vh;
        padding: 26px 14px 32px;
      }

      .glow { position: fixed; width: 320px; height: 320px; border-radius: 50%; filter: blur(140px); opacity: 0.4; pointer-events: none; z-index: 0; }
      .glow-1 { top: -80px; left: -60px; background: rgba(101, 209, 255, 0.4); }
      .glow-2 { bottom: -60px; right: 0; background: rgba(183, 123, 255, 0.35); }

      main { position: relative; z-index: 1; max-width: 1200px; margin: 0 auto; display: flex; flex-direction: column; gap: 16px; }

      .panel {
        background: linear-gradient(140deg, rgba(255,255,255,0.02), rgba(255,255,255,0.0)), var(--panel);
        border: 1px solid var(--border);
        border-radius: 16px;
        padding: 16px;
        box-shadow: var(--glow);
        backdrop-filter: blur(10px);
      }

      h1 { margin: 0 0 6px; font-size: 28px; letter-spacing: -0.02em; }
      h3 { margin: 0; }
      .eyebrow { text-transform: uppercase; letter-spacing: 0.08em; font-size: 11px; color: var(--muted); margin: 0 0 4px; }
      .subtitle { margin: 0; color: var(--muted); }
      .pill { background: rgba(101, 209, 255, 0.14); border: 1px solid rgba(101, 209, 255, 0.5); color: var(--text); padding: 8px 12px; border-radius: 999px; font-weight: 600; font-size: 13px; }

      .hero-header { display: flex; justify-content: space-between; gap: 12px; align-items: center; }
      .hud-grid { display: grid; grid-template-columns: 1.2fr 0.8fr; gap: 16px; }
      @media (max-width: 900px) { .hud-grid { grid-template-columns: 1fr; } .hero-header { flex-direction: column; align-items: flex-start; } }

      .stat-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 10px; }
      .stat-card { background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 12px; }
      .label { font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); margin-bottom: 6px; }
      .value { font-size: 26px; font-weight: 700; line-height: 1.1; }
      .small { color: var(--muted); font-size: 13px; margin: 4px 0 0; }

      .bar { width: 100%; height: 10px; background: rgba(255, 255, 255, 0.06); border-radius: 999px; overflow: hidden; margin-top: 8px; }
      .bar-fill { height: 100%; width: 0%; background: linear-gradient(90deg, var(--accent), var(--accent-2)); transition: width 0.25s ease, background 0.2s ease; }
      .bar-fill.hp { background: linear-gradient(90deg, #22d3ee, #06b6d4); }
      .bar-fill.xp { background: linear-gradient(90deg, #a855f7, #38bdf8); }
      .bar-fill.enemy { background: linear-gradient(90deg, #f87171, #fb7185); }

      .enemy-header { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
      .state-chip { border-radius: 999px; padding: 6px 10px; font-size: 12px; border: 1px solid var(--border); background: rgba(255,255,255,0.04); }
      .primary { border: 1px solid rgba(101, 209, 255, 0.6); background: linear-gradient(90deg, var(--accent), var(--accent-2)); color: #0b1222; font-weight: 800; padding: 12px 14px; border-radius: 12px; cursor: pointer; transition: transform 0.1s ease, box-shadow 0.2s ease; }
      .primary:hover { transform: translateY(-1px); box-shadow: 0 12px 30px rgba(0,0,0,0.35); }
      .primary:active { transform: translateY(0); }

      .heroes, .inventory { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 10px; }
      .hero-card, .item-chip { background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 12px; }
      .hero-top { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
      .portrait { width: 100%; height: 120px; border-radius: 10px; overflow: hidden; border: 1px solid rgba(255,255,255,0.06); margin-top: 8px; }
      .role { padding: 4px 10px; border-radius: 999px; border: 1px solid var(--border); font-size: 12px; text-transform: capitalize; }
      .role.tank { border-color: rgba(74, 222, 128, 0.5); color: #bbf7d0; }
      .role.dps { border-color: rgba(248, 113, 113, 0.6); color: #fecdd3; }
      .role.support { border-color: rgba(56, 189, 248, 0.6); color: #bae6fd; }
      .rarity { font-size: 12px; padding: 4px 8px; border-radius: 999px; border: 1px solid var(--border); text-transform: capitalize; }
      .rarity.common { border-color: #475569; color: #cbd5e1; }
      .rarity.uncommon { border-color: #22c55e; color: #bbf7d0; }
      .rarity.rare { border-color: #38bdf8; color: #bae6fd; }
      .rarity.epic { border-color: #a855f7; color: #e9d5ff; }
      .rarity.legendary { border-color: #fbbf24; color: #fef08a; }
      .stat-line { display: flex; gap: 12px; margin-top: 6px; color: var(--muted); font-size: 13px; flex-wrap: wrap; }

      .inventory { grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); }
      .item-chip { display: flex; justify-content: space-between; align-items: center; gap: 8px; border-radius: 10px; cursor: default; }

      .log { margin-top: 12px; display: grid; gap: 8px; }
      .log-item { background: rgba(255,255,255,0.03); border: 1px solid var(--border); border-radius: 10px; padding: 10px 12px; font-size: 14px; display: flex; gap: 8px; align-items: center; }
      .dot { width: 10px; height: 10px; border-radius: 50%; background: var(--accent); }
      .dot.loot { background: #fbbf24; }
      .dot.level { background: #4ade80; }
      .dot.dmg { background: #fb7185; }
      .stage-row { display: flex; justify-content: space-between; align-items: center; color: var(--muted); font-size: 13px; margin-top: 8px; }

      .grid-two { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
      @media (max-width: 900px) { .grid-two { grid-template-columns: 1fr; } }
    </style>
  </head>
  <body>
    <div class="glow glow-1"></div>
    <div class="glow glow-2"></div>
    <main>
      <div class="panel hero-header">
        <div>
          <p class="eyebrow">Offline preview</p>
          <h1>${title}</h1>
          <p class="subtitle">${description}</p>
        </div>
        <span class="pill">Magical Storybook</span>
      </div>

      <section class="hud-grid">
        <div class="panel">
          <div class="stat-grid">
            <div class="stat-card">
              <div class="label">Nivel</div>
              <div class="value" id="levelValue">1</div>
              <div class="bar"><div class="bar-fill xp" id="xpFill"></div></div>
              <div class="small">XP <span id="xpValue">0</span>/<span id="xpToLevel">120</span></div>
            </div>
            <div class="stat-card">
              <div class="label">HP</div>
              <div class="value"><span id="playerHpValue">0</span> / <span id="playerHpMax">0</span></div>
              <div class="bar"><div class="bar-fill hp" id="playerHpFill"></div></div>
              <div class="small">Salud del equipo</div>
            </div>
            <div class="stat-card">
              <div class="label">Oro</div>
              <div class="value" id="goldValue">0</div>
              <div class="small">+<span id="gpsValue">0</span> oro / seg</div>
            </div>
            <div class="stat-card">
              <div class="label">DPS</div>
              <div class="value" id="dpsValue">0</div>
              <div class="small">Auto dps del grupo</div>
            </div>
          </div>
        </div>

        <div class="panel">
          <div class="enemy-header">
            <div>
              <div class="label">Enemigo</div>
              <h3 id="enemyName">-</h3>
              <div class="small" id="battleState">En combate</div>
            </div>
            <div class="state-chip">
              Stage <span id="stageValue">1</span>
            </div>
          </div>
          <div class="bar"><div class="bar-fill enemy" id="enemyFill"></div></div>
          <div class="stage-row">
            <span id="enemyHpValue">0</span> HP
            <span>Enemigo <span id="enemyIndex">1</span>/<span id="enemyTotal">1</span></span>
          </div>
          <div style="margin-top: 12px; display: flex; gap: 10px; align-items: center;">
            <button class="primary" id="attackBtn">Ataque manual</button>
          </div>
        </div>
      </section>

      <section class="panel">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;">
          <div>
            <div class="label">Registro</div>
            <h3 style="margin:0;">Eventos de combate</h3>
          </div>
          <div class="state-chip" id="statusChip">Activo</div>
        </div>
        <div class="log" id="logList"></div>
      </section>

      <section class="grid-two">
        <div class="panel">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <div>
              <div class="label">Heroes</div>
              <h3 style="margin:0;">Composición</h3>
            </div>
          </div>
          <div class="heroes" id="heroesList"></div>
        </div>
        <div class="panel">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <div>
              <div class="label">Inventario</div>
              <h3 style="margin:0;">Botín y rarezas</h3>
            </div>
          </div>
          <div class="inventory" id="inventoryList"></div>
        </div>
      </section>
    </main>
    <script src="./game.js"></script>
  </body>
</html>
`;
}

function buildGameJs(spec: GameSpec, portraits: Record<string, string>): string {
  const specJson = JSON.stringify(spec, null, 2);
  const portraitsJson = JSON.stringify(portraits);
  const tickMs = spec.progression.tickMs;

  return `const GAME_SPEC = ${specJson};
const PORTRAITS = ${portraitsJson};
const STATE_KEY = "idle-rpg-generated-state-v2";
const TICK_MS = ${tickMs};

function loadState() {
  try {
    const saved = localStorage.getItem(STATE_KEY);
    if (saved) return JSON.parse(saved);
  } catch (err) {
    console.warn("No saved state", err);
  }
  return null;
}

function normalizeInventory(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    if (typeof item === "string") return { name: item, rarity: "common" };
    if (item && typeof item === "object") return { name: item.name || "Item", rarity: item.rarity || "common", bonus: item.bonus };
    return { name: "Item", rarity: "common" };
  });
}

function normalizeState(raw) {
  const heroes = GAME_SPEC.roster.heroes.map((hero) => ({
    id: hero.id,
    name: hero.name,
    hp: hero.stats.hp,
    maxHp: hero.stats.hp,
    atk: hero.stats.atk,
    def: hero.stats.def,
    spd: hero.stats.spd,
    role: hero.roleHint,
    rarity: hero.rarity,
  }));

  const enemy = GAME_SPEC.enemies.find((e) => !e.isBoss) || GAME_SPEC.enemies[0];

  const base = {
    level: 1,
    xp: 0,
    xpToLevel: 120,
    playerHp: heroes.reduce((sum, h) => sum + h.hp, 0),
    playerMaxHp: heroes.reduce((sum, h) => sum + h.hp, 0),
    gold: 0,
    kills: 0,
    stageIndex: 0,
    enemyIndex: 0,
    enemyHp: enemy ? enemy.stats.hp : 100,
    inventory: GAME_SPEC.items.sampleItems.slice(0, 6),
    combatLog: [],
    heroes,
  };

  const merged = { ...base, ...(raw || {}) };
  merged.inventory = normalizeInventory(merged.inventory);
  merged.combatLog = Array.isArray(merged.combatLog)
    ? merged.combatLog.map((entry) =>
        typeof entry === "string" ? { text: entry, type: "info" } : entry
      )
    : [];
  merged.playerMaxHp = merged.playerMaxHp || merged.playerHp || base.playerMaxHp;
  merged.playerHp = Math.min(merged.playerHp || merged.playerMaxHp, merged.playerMaxHp);
  merged.enemyHp = merged.enemyHp || base.enemyHp;
  merged.level = merged.level || base.level;
  merged.xp = merged.xp || base.xp;
  merged.xpToLevel = merged.xpToLevel || base.xpToLevel;
  merged.stageIndex = merged.stageIndex || 0;
  merged.enemyIndex = merged.enemyIndex || 0;
  return merged;
}

let state = normalizeState(loadState());

function saveState() {
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
  } catch (err) {
    console.warn("Failed to persist state", err);
  }
}

function currentEnemy() {
  const list = GAME_SPEC.enemies || [];
  if (!list.length) return { name: "Sin enemigos", stats: { hp: 100, atk: 5, def: 2 }, goldRange: [5, 10], xpRange: [5, 8], isBoss: false };
  return list[state.enemyIndex % list.length];
}

function fmt(value) {
  if (value >= 1_000_000) return (value / 1_000_000).toFixed(1) + "M";
  if (value >= 1_000) return (value / 1_000).toFixed(1) + "K";
  return Math.max(0, Math.floor(value)).toString();
}

function formatStats(stats) {
  if (!stats) return "";
  const parts = [];
  if (stats.atk) parts.push("+" + stats.atk + " ATK");
  if (stats.def) parts.push("+" + stats.def + " DEF");
  if (stats.hp) parts.push("+" + stats.hp + " HP");
  if (stats.spd) parts.push("+" + stats.spd + " SPD");
  if (stats.crit) parts.push("+" + stats.crit + " CRIT");
  return parts.join(" / ");
}

function logEvent(text, type = "info") {
  state.combatLog = [...(state.combatLog || []), { text, type, at: Date.now() }].slice(-8);
}

function heroDps() {
  const heroes = state.heroes || [];
  return heroes.reduce((sum, hero) => {
    const base = hero.atk || 0;
    const crit = 1 + (hero.rarity === "legendary" ? 0.3 : 0.15);
    return sum + base * crit;
  }, 0);
}

function grantXp(amount) {
  state.xp += amount;
  let leveled = false;
  while (state.xp >= state.xpToLevel) {
    state.xp -= state.xpToLevel;
    state.level += 1;
    state.xpToLevel = Math.floor(state.xpToLevel * 1.15 + 24);
    state.playerMaxHp += 18;
    state.playerHp = state.playerMaxHp;
    leveled = true;
  }
  if (leveled) {
    logEvent("Subiste de nivel a " + state.level, "level");
  }
}

function ensureEnemyHp() {
  const enemy = currentEnemy();
  const base = enemy.stats?.hp || 100;
  const scale = 1 + state.stageIndex * 0.15;
  const scaled = Math.ceil(base * scale);
  if (!state.enemyHp || state.enemyHp > scaled) {
    state.enemyHp = scaled;
  }
}

function handleEnemyDefeat(enemy) {
  state.kills += 1;
  const goldGain = (enemy.goldRange?.[0] || 10) + Math.random() * ((enemy.goldRange?.[1] || 20) - (enemy.goldRange?.[0] || 10));
  state.gold += goldGain;
  grantXp((enemy.xpRange?.[0] || 10) + Math.random() * ((enemy.xpRange?.[1] || 16) - (enemy.xpRange?.[0] || 10)));

  const loot = GAME_SPEC.items.sampleItems || [];
  if (loot.length) {
    const item = loot[state.kills % loot.length];
    if (item) {
      state.inventory.push({
        name: item.name,
        rarity: item.rarity,
        bonus: formatStats(item.stats),
      });
      state.inventory = state.inventory.slice(-12);
      logEvent("Botín: " + item.name, "loot");
    }
  }
  state.enemyIndex = (state.enemyIndex + 1) % Math.max((GAME_SPEC.enemies || []).length, 1);
  if (state.enemyIndex === 0) {
    state.stageIndex += 1;
    logEvent("Avanzaste al stage " + (state.stageIndex + 1), "level");
  }
  ensureEnemyHp();
}

function manualAttack() {
  const spike = 20 + state.level * 3;
  state.gold += GAME_SPEC.progression.goldPerSec * 0.5;
  state.enemyHp -= spike;
  logEvent("Golpe manual por " + fmt(spike) + " dmg", "dmg");
  if (state.enemyHp <= 0) {
    handleEnemyDefeat(currentEnemy());
  }
  render();
  saveState();
}

function idleTick() {
  const goldPerSec = GAME_SPEC.progression.goldPerSec;
  const gain = (goldPerSec * TICK_MS) / 1000;
  state.gold += gain;
}

function combatTick() {
  const enemy = currentEnemy();
  ensureEnemyHp();

  const damage = heroDps();
  state.enemyHp -= damage;

  const enemyHit = Math.max(4, Math.floor((enemy.stats?.atk || 10) * 0.25));
  state.playerHp = Math.max(state.playerHp - enemyHit, 0);

  if (state.playerHp <= 0) {
    state.playerHp = state.playerMaxHp;
    logEvent("Recuperas fuerzas tras caer", "level");
  }

  if (state.enemyHp <= 0) {
    handleEnemyDefeat(enemy);
  }
}

function render() {
  const enemy = currentEnemy();
  const goldEl = document.getElementById("goldValue");
  const gpsEl = document.getElementById("gpsValue");
  const dpsEl = document.getElementById("dpsValue");
  const stageEl = document.getElementById("stageValue");
  const enemyIndexEl = document.getElementById("enemyIndex");
  const enemyTotalEl = document.getElementById("enemyTotal");
  const enemyNameEl = document.getElementById("enemyName");
  const enemyHpEl = document.getElementById("enemyHpValue");
  const enemyFill = document.getElementById("enemyFill");
  const playerHpEl = document.getElementById("playerHpValue");
  const playerHpMaxEl = document.getElementById("playerHpMax");
  const playerHpFill = document.getElementById("playerHpFill");
  const xpEl = document.getElementById("xpValue");
  const xpToLevelEl = document.getElementById("xpToLevel");
  const xpFill = document.getElementById("xpFill");
  const levelEl = document.getElementById("levelValue");
  const stateChip = document.getElementById("statusChip");
  const battleState = document.getElementById("battleState");
  const heroesList = document.getElementById("heroesList");
  const inventoryList = document.getElementById("inventoryList");
  const logList = document.getElementById("logList");

  if (goldEl) goldEl.textContent = fmt(state.gold);
  if (gpsEl) gpsEl.textContent = fmt(GAME_SPEC.progression.goldPerSec);
  if (dpsEl) dpsEl.textContent = fmt(heroDps());
  if (stageEl) stageEl.textContent = (state.stageIndex + 1).toString();
  if (enemyIndexEl) enemyIndexEl.textContent = (state.enemyIndex + 1).toString();
  if (enemyTotalEl) enemyTotalEl.textContent = Math.max((GAME_SPEC.enemies || []).length, 1).toString();
  if (enemyNameEl) enemyNameEl.textContent = enemy.name || "Enemigo";
  if (enemyHpEl) enemyHpEl.textContent = Math.max(Math.ceil(state.enemyHp), 0).toString();
  if (playerHpEl) playerHpEl.textContent = Math.max(Math.ceil(state.playerHp), 0).toString();
  if (playerHpMaxEl) playerHpMaxEl.textContent = Math.max(Math.ceil(state.playerMaxHp), 0).toString();
  if (xpEl) xpEl.textContent = Math.floor(state.xp).toString();
  if (xpToLevelEl) xpToLevelEl.textContent = Math.floor(state.xpToLevel).toString();
  if (levelEl) levelEl.textContent = state.level.toString();

  if (enemyFill) {
    const hpPct = Math.max(0, Math.min(100, (state.enemyHp / Math.max(enemy.stats?.hp || 1, 1)) * 100));
    enemyFill.style.width = hpPct + "%";
  }
  if (playerHpFill) {
    const hpPct = Math.max(0, Math.min(100, (state.playerHp / Math.max(state.playerMaxHp || 1, 1)) * 100));
    playerHpFill.style.width = hpPct + "%";
  }
  if (xpFill) {
    const xpPct = Math.max(0, Math.min(100, (state.xp / Math.max(state.xpToLevel || 1, 1)) * 100));
    xpFill.style.width = xpPct + "%";
  }

  if (battleState) battleState.textContent = state.enemyHp > 0 ? "En combate" : "Victoria";
  if (stateChip) stateChip.textContent = state.enemyHp > 0 ? "Activo" : "Listo para el siguiente";

  if (heroesList) {
    const heroes = GAME_SPEC.roster.heroes || [];
    heroesList.innerHTML = heroes
      .map((hero) => {
        const portrait = PORTRAITS[hero.id] || "";
        return \`<div class="hero-card">
          <div class="hero-top">
            <div>
              <div class="label">Heroe</div>
              <div class="value" style="font-size:18px;">\${hero.name}</div>
              <div class="small">\${hero.faction} · \${hero.class}</div>
            </div>
            <div style="display:flex;gap:6px;align-items:center;">
              <span class="role \${hero.roleHint}">\${hero.roleHint}</span>
              <span class="rarity \${hero.rarity}">\${hero.rarity}</span>
            </div>
          </div>
          <div class="portrait" aria-hidden="true">\${portrait}</div>
          <div class="stat-line">
            <span>\${hero.stats.hp} HP</span>
            <span>\${hero.stats.atk} ATK</span>
            <span>\${hero.stats.def} DEF</span>
            <span>\${hero.stats.spd} SPD</span>
          </div>
        </div>\`;
      })
      .join("");
  }

  if (inventoryList) {
    const items = GAME_SPEC.items.sampleItems || [];
    if (!items.length) {
      inventoryList.innerHTML = '<div class="item-chip"><span class="small">Sin botín aún</span><span class="rarity common">none</span></div>';
    } else {
      inventoryList.innerHTML = items
        .map((item) => {
          const rarity = item.rarity || "common";
          const bonus = formatStats(item.stats);
          const title = bonus ? \`\${item.name} - \${bonus}\` : item.name;
          return \`<div class="item-chip" title="\${title}">
            <span style="font-weight:600;">\${item.name}</span>
            <span class="rarity \${rarity}">\${rarity}</span>
          </div>\`;
        })
        .join("");
    }
  }

  if (logList) {
    const entries = (state.combatLog || []).slice(-8).reverse();
    if (!entries.length) {
      logList.innerHTML = '<div class="log-item"><div class="dot"></div><div>Combate listo. Ataca para comenzar.</div></div>';
    } else {
      logList.innerHTML = entries
        .map((entry) => {
          const type = entry.type || "info";
          return \`<div class="log-item">
            <div class="dot \${type}"></div>
            <div>\${entry.text}</div>
          </div>\`;
        })
        .join("");
    }
  }
}

function startLoops() {
  setInterval(() => {
    idleTick();
    render();
    saveState();
  }, TICK_MS);

  setInterval(() => {
    combatTick();
    render();
    saveState();
  }, TICK_MS);
}

document.addEventListener("DOMContentLoaded", () => {
  ensureEnemyHp();
  render();
  const attackBtn = document.getElementById("attackBtn");
  if (attackBtn) {
    attackBtn.addEventListener("click", manualAttack);
  }
  startLoops();
});
`;
}

export function buildIdleRpgProject(spec: GameSpec): GeneratedProject {
  const portraits: Record<string, string> = {};
  spec.roster.heroes.forEach((hero, idx) => {
    portraits[hero.id] = buildPortraitSvg(hero, spec.meta.seed + idx);
  });

  const files: GeneratedFile[] = [
    { path: "index.html", content: buildIndexHtml(spec) },
    { path: "game.js", content: buildGameJs(spec, portraits) },
    { path: "spec.json", content: buildGameJson(spec) },
  ];

  return { files };
}
