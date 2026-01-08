import type PhaserLib from "phaser";

type VisualRole = "front" | "dps" | "support";

const SIZE = 72;

const ROLE_ACCENTS: Record<VisualRole, number> = {
  front: 0xffb27f,
  dps: 0x9ad8ff,
  support: 0xb4f0c2,
};

const TEAM_BORDER: Record<"ally" | "enemy", number> = {
  ally: 0x7ce4ff,
  enemy: 0xffb86c,
};

export function getOrCreatePortraitTexture(
  scene: PhaserLib.Scene,
  unitId: string,
  name: string,
  role: VisualRole,
  team: "ally" | "enemy"
): string {
  const key = `portrait:${unitId}`;
  if (scene.textures.exists(key)) return key;

  const g = scene.add.graphics({ x: 0, y: 0 });
  const half = SIZE / 2;
  const accent = ROLE_ACCENTS[role];
  const border = TEAM_BORDER[team];

  // Outer ring
  g.lineStyle(4, border, 0.9);
  g.strokeCircle(half, half, half - 2);

  // Gradient-like background using concentric fills
  g.fillStyle(accent, 0.22);
  g.fillCircle(half, half, half - 5);
  g.fillStyle(0x0c1222, 0.85);
  g.fillCircle(half, half, half - 8);
  g.fillStyle(0x0f172a, 0.65);
  g.fillCircle(half, half + 4, half - 14);

  // Bust silhouette
  const headY = half - 8;
  g.fillStyle(0xffffff, 0.92);
  g.fillCircle(half, headY, 11);
  g.fillStyle(0xffffff, 0.9);
  g.fillRoundedRect(half - 18, headY + 6, 36, 22, 10);

  // Role marker
  g.fillStyle(accent, 0.9);
  if (role === "front") {
    g.fillRoundedRect(half - 16, headY - 13, 32, 8, 4);
    g.fillRoundedRect(half - 22, headY + 8, 44, 10, 6);
  } else if (role === "dps") {
    g.fillTriangle(half - 4, headY + 2, half + 18, headY + 10, half + 8, headY + 20);
  } else {
    g.lineStyle(3, accent, 0.9);
    g.strokeCircle(half, headY - 10, 8);
    g.fillStyle(accent, 0.18);
    g.fillCircle(half, headY - 10, 8);
  }

  // Initials (fallback detail)
  const initials = name.trim().slice(0, 2).toUpperCase();
  const text = scene.add.text(half, half + 14, initials, {
    fontFamily: "Chakra Petch, sans-serif",
    fontSize: "12px",
    color: "#e2e8f0",
    align: "center",
  });
  text.setOrigin(0.5);

  const rt = scene.add.renderTexture(0, 0, SIZE, SIZE);
  rt.draw(g);
  rt.draw(text);
  rt.saveTexture(key);

  g.destroy();
  text.destroy();
  rt.destroy();

  return key;
}

export function createPortraitSprite(
  scene: PhaserLib.Scene,
  textureKey: string,
  scale: number
): PhaserLib.GameObjects.Image {
  const sprite = scene.add.image(0, 0, textureKey);
  sprite.setDisplaySize(SIZE * scale, SIZE * scale);
  sprite.setOrigin(0.5);
  sprite.setDepth(3);
  sprite.setAlpha(0.92);
  return sprite;
}
