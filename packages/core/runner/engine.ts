import { RunnerConfig, RunnerObstacle, RunnerPlayer, RunnerState } from "./types.js";

export const DEFAULT_RUNNER_CONFIG: RunnerConfig = {
  width: 640,
  height: 360,
  gravity: 0.0015,
  jumpVelocity: -0.6,
  baseSpeed: 0.25,
  accelPerSecond: 0.00005,
  spawnIntervalMs: 1200,
  obstacleWidth: 28,
  obstacleHeight: 42,
  groundY: 300,
};

export function createRunnerState(config: RunnerConfig = DEFAULT_RUNNER_CONFIG): RunnerState {
  return {
    running: false,
    gameOver: false,
    score: 0,
    speed: config.baseSpeed,
    elapsedMs: 0,
    spawnTimer: 0,
    player: { x: config.width * 0.15, y: config.groundY, vy: 0, onGround: true },
    obstacles: [],
    config,
  };
}

export function startRunner(state: RunnerState): RunnerState {
  if (state.running) return state;
  return { ...state, running: true, gameOver: false };
}

export function restartRunner(config: RunnerConfig = DEFAULT_RUNNER_CONFIG): RunnerState {
  return createRunnerState(config);
}

export function stepRunner(state: RunnerState, deltaMs: number, jump: boolean): RunnerState {
  if (!state.running || state.gameOver) return state;
  const cfg = state.config;
  let speed = state.speed + cfg.accelPerSecond * deltaMs;

  // Player physics
  const player: RunnerPlayer = { ...state.player };
  if (jump && player.onGround) {
    player.vy = cfg.jumpVelocity;
    player.onGround = false;
  }
  player.vy += cfg.gravity * deltaMs;
  player.y += player.vy * deltaMs;
  if (player.y >= cfg.groundY) {
    player.y = cfg.groundY;
    player.vy = 0;
    player.onGround = true;
  }

  // Obstacles
  const obstacles: RunnerObstacle[] = [];
  state.obstacles.forEach((obs) => {
    const nextX = obs.x - speed * deltaMs;
    if (nextX + obs.width > 0) {
      obstacles.push({ ...obs, x: nextX });
    }
  });

  // Spawn new obstacle
  const spawnTimer = state.spawnTimer + deltaMs;
  if (spawnTimer >= cfg.spawnIntervalMs) {
    obstacles.push({
      x: cfg.width + cfg.obstacleWidth,
      y: cfg.groundY,
      width: cfg.obstacleWidth,
      height: cfg.obstacleHeight,
    });
  }

  // Collision
  const playerBox = {
    x: player.x,
    y: player.y - 32,
    width: 26,
    height: 32,
  };
  const hit = obstacles.some((obs) => intersects(playerBox, obs));

  const nextState: RunnerState = {
    ...state,
    player,
    obstacles,
    speed,
    spawnTimer: spawnTimer >= cfg.spawnIntervalMs ? 0 : spawnTimer,
    elapsedMs: state.elapsedMs + deltaMs,
    score: state.score + Math.floor(deltaMs * 0.01 * speed),
    gameOver: hit,
    running: hit ? false : state.running,
  };

  return nextState;
}

function intersects(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number }
) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y && a.y + a.height > b.y - b.height;
}
