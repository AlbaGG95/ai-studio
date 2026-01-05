import type PhaserLib from "phaser";

type FlashOptions = {
  duration?: number;
  shake?: boolean;
  speed?: 1 | 2;
};

export function hitFlash(scene: PhaserLib.Scene, target: PhaserLib.GameObjects.Container, options: FlashOptions = {}) {
  const duration = Math.max(60, Math.round((options.duration ?? 140) / (options.speed ?? 1)));
  scene.tweens.add({
    targets: target,
    alpha: { from: 1, to: 0.6 },
    yoyo: true,
    duration,
    ease: "Quad.easeOut",
  });

  if (options.shake) {
    scene.tweens.add({
      targets: target,
      x: target.x + 8,
      yoyo: true,
      duration,
      repeat: 1,
      ease: "Sine.easeInOut",
    });
  }
}

export function healFlash(scene: PhaserLib.Scene, target: PhaserLib.GameObjects.Container, speed: 1 | 2 = 1) {
  const duration = Math.max(80, Math.round(240 / speed));
  const sx = target.scaleX || 1;
  const sy = target.scaleY || 1;
  scene.tweens.add({
    targets: target,
    scaleX: sx * 1.04,
    scaleY: sy * 1.04,
    yoyo: true,
    duration,
    ease: "Sine.easeInOut",
  });
}
