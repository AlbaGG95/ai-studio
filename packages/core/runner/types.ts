export interface RunnerConfig {
  width: number;
  height: number;
  gravity: number;
  jumpVelocity: number;
  baseSpeed: number;
  accelPerSecond: number;
  spawnIntervalMs: number;
  obstacleWidth: number;
  obstacleHeight: number;
  groundY: number;
}

export interface RunnerPlayer {
  x: number;
  y: number;
  vy: number;
  onGround: boolean;
}

export interface RunnerObstacle {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RunnerState {
  running: boolean;
  score: number;
  speed: number;
  elapsedMs: number;
  spawnTimer: number;
  player: RunnerPlayer;
  obstacles: RunnerObstacle[];
  config: RunnerConfig;
  gameOver: boolean;
}
