import type PhaserLib from "phaser";

export function screenShake(scene: PhaserLib.Scene, intensity = 0.004, duration = 120, speed: 1 | 2 = 1) {
  const camera = scene.cameras.main;
  if (!camera) return;
  const dur = Math.max(40, Math.round(duration / speed));
  camera.shake(dur, intensity);
}
