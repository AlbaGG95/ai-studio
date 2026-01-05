import type PhaserLib from "phaser";

type FloatKind = "hit" | "crit" | "heal";

type ActiveFloat = {
  targetId: string;
  text: PhaserLib.GameObjects.Text;
};

export class FloatingTextManager {
  private scene: PhaserLib.Scene;
  private activeByTarget = new Map<string, ActiveFloat[]>();
  private maxPerTarget = 3;

  constructor(scene: PhaserLib.Scene) {
    this.scene = scene;
  }

  spawn(kind: FloatKind, value: number, targetId: string, x: number, y: number, speed: 1 | 2) {
    const list = this.activeByTarget.get(targetId) ?? [];
    while (list.length >= this.maxPerTarget) {
      const oldest = list.shift();
      oldest?.text.destroy();
    }

    const color = kind === "heal" ? "#5ef2a0" : kind === "crit" ? "#fca5a5" : "#f8fafc";
    const fontSize = kind === "crit" ? 26 : 20;
    const offsetX = (Math.random() - 0.5) * 14;
    const offsetY = kind === "heal" ? -18 : -10;
    const label = kind === "heal" ? `+${value}` : `-${value}`;

    const text = this.scene.add.text(x + offsetX, y + offsetY, label, {
      fontFamily: "Chakra Petch, sans-serif",
      fontSize: `${fontSize}px`,
      color,
      fontStyle: kind === "crit" ? "bold" : "normal",
      stroke: "#0b1222",
      strokeThickness: 3,
    });
    text.setOrigin(0.5);
    text.setAlpha(0);
    text.setDepth(10);
    list.push({ targetId, text });
    this.activeByTarget.set(targetId, list);

    const duration = Math.max(220, Math.round(720 / speed));
    const targetY = y - (kind === "heal" ? 48 : 40);

    this.scene.tweens.add({
      targets: text,
      y: targetY,
      alpha: { from: 0, to: 1 },
      scale: kind === "crit" ? { from: 1.1, to: 0.98 } : { from: 1, to: 0.98 },
      duration,
      ease: "Quad.easeOut",
      onComplete: () => {
        text.destroy();
        const arr = this.activeByTarget.get(targetId);
        if (!arr) return;
        this.activeByTarget.set(
          targetId,
          arr.filter((item) => item.text !== text)
        );
      },
    });
  }

  clear() {
    this.activeByTarget.forEach((list) => {
      list.forEach((item) => item.text.destroy());
    });
    this.activeByTarget.clear();
  }
}
