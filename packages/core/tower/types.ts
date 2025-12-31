export interface TowerConfig {
  rows: number;
  cols: number;
  baseHealth: number;
  towerDamage: number;
  towerRange: number;
  enemyHealth: number;
  enemySpeed: number;
  enemiesPerWave: number;
  pathRow: number;
}

export interface Tower {
  row: number;
  col: number;
}

export interface Enemy {
  id: string;
  row: number;
  x: number; // column position as float
  hp: number;
}

export interface TowerDefenseState {
  config: TowerConfig;
  towers: Tower[];
  enemies: Enemy[];
  wave: number;
  running: boolean;
  baseHealth: number;
  victory: boolean;
  defeated: boolean;
}
