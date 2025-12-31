import { Enemy, Tower, TowerConfig, TowerDefenseState } from "./types.js";

export const DEFAULT_TD_CONFIG: TowerConfig = {
  rows: 5,
  cols: 8,
  baseHealth: 10,
  towerDamage: 1,
  towerRange: 2,
  enemyHealth: 3,
  enemySpeed: 0.3, // cells per tick
  enemiesPerWave: 6,
  pathRow: 2,
};

export function createTowerDefenseState(config: Partial<TowerConfig> = {}): TowerDefenseState {
  const cfg = { ...DEFAULT_TD_CONFIG, ...config };
  return {
    config: cfg,
    towers: [],
    enemies: [],
    wave: 0,
    running: false,
    baseHealth: cfg.baseHealth,
    victory: false,
    defeated: false,
  };
}

export function placeTower(state: TowerDefenseState, row: number, col: number): TowerDefenseState {
  if (state.running || state.defeated || state.victory) return state;
  if (row < 0 || col < 0 || row >= state.config.rows || col >= state.config.cols) return state;
  if (state.towers.some((t) => t.row === row && t.col === col)) return state;
  return { ...state, towers: [...state.towers, { row, col }] };
}

export function startWave(state: TowerDefenseState): TowerDefenseState {
  if (state.running || state.defeated || state.victory) return state;
  const enemies: Enemy[] = Array.from({ length: state.config.enemiesPerWave }).map((_, i) => ({
    id: `e${state.wave}-${i}`,
    row: state.config.pathRow,
    x: -i * 2,
    hp: state.config.enemyHealth,
  }));
  return { ...state, running: true, wave: state.wave + 1, enemies };
}

export function step(state: TowerDefenseState, deltaMs: number): TowerDefenseState {
  if (!state.running) return state;
  const cfg = state.config;
  let baseHealth = state.baseHealth;
  let enemies = state.enemies.map((e) => ({ ...e, x: e.x + cfg.enemySpeed * (deltaMs / 100) }));

  // tower attacks
  enemies = enemies.map((enemy) => {
    let hp = enemy.hp;
    state.towers.forEach((tower) => {
      if (tower.row !== enemy.row) return;
      const dist = Math.abs(tower.col - enemy.x);
      if (dist <= cfg.towerRange) {
        hp -= cfg.towerDamage * (deltaMs / 500);
      }
    });
    return { ...enemy, hp };
  });

  // filter defeated
  enemies = enemies.filter((e) => e.hp > 0);

  // check base hits
  enemies = enemies.filter((e) => {
    if (e.x >= cfg.cols) {
      baseHealth -= 1;
      return false;
    }
    return true;
  });

  const defeated = baseHealth <= 0;
  const victory = !defeated && state.running && enemies.length === 0 && state.wave >= 1;
  return {
    ...state,
    enemies,
    baseHealth,
    running: defeated ? false : enemies.length > 0,
    defeated,
    victory: victory || state.victory,
  };
}
