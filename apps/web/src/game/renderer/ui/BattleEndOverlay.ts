import type PhaserLib from "phaser";

type OverlayOptions = {
  onContinue?: () => void;
  result: "victory" | "defeat";
  width: number;
  height: number;
};

export type BattleEndOverlay = {
  container: PhaserLib.GameObjects.Container;
  layout: (width: number, height: number) => void;
  destroy: () => void;
};

export function createBattleEndOverlay(scene: PhaserLib.Scene, opts: OverlayOptions): BattleEndOverlay {
  const overlay = scene.add.container(0, 0);

  const backdrop = scene.add.rectangle(0, 0, opts.width, opts.height, 0x02040a, 0.72).setOrigin(0, 0);
  backdrop.setInteractive({ useHandCursor: false });

  const card = scene.add.container(0, 0);
  const cardBg = scene.add.rectangle(0, 0, 320, 200, 0x0b1222, 0.9).setOrigin(0.5);
  cardBg.setStrokeStyle(2, 0x7ce4ff, opts.result === "victory" ? 0.7 : 0.4);
  const title = scene.add.text(0, -32, opts.result === "victory" ? "Victory" : "Defeat", {
    fontFamily: "Space Grotesk, sans-serif",
    fontSize: "30px",
    color: opts.result === "victory" ? "#86ff78" : "#fda4af",
    align: "center",
  });
  title.setOrigin(0.5);
  const subtitle = scene.add.text(0, 0, "Tap to continue", {
    fontFamily: "Chakra Petch, sans-serif",
    fontSize: "16px",
    color: "#e2e8f0",
    align: "center",
  });
  subtitle.setOrigin(0.5);

  const button = scene.add.container(0, 54);
  const btnBg = scene.add.rectangle(0, 0, 180, 44, 0x7ce4ff, 1).setOrigin(0.5);
  btnBg.setStrokeStyle(2, 0x0b1222, 0.8);
  btnBg.setInteractive({ useHandCursor: true });
  const buttonLabel = scene.add.text(0, 0, "Continue", {
    fontFamily: "Chakra Petch, sans-serif",
    fontSize: "16px",
    color: "#0b1222",
    fontStyle: "bold",
  });
  buttonLabel.setOrigin(0.5);
  button.add([btnBg, buttonLabel]);

  const onContinue = () => opts.onContinue?.();
  button.on("pointerover", () => btnBg.setFillStyle(0x9cf2ff, 1));
  button.on("pointerout", () => btnBg.setFillStyle(0x7ce4ff, 1));
  button.on("pointerup", () => onContinue());
  btnBg.on("pointerup", () => onContinue());
  backdrop.on("pointerup", () => onContinue());

  card.add([cardBg, title, subtitle, button]);
  overlay.add([backdrop, card]);
  overlay.setDepth(200);

  const layout = (width: number, height: number) => {
    backdrop.setSize(width, height);
    card.setPosition(width / 2, height * 0.35);
  };

  layout(opts.width, opts.height);

  return {
    container: overlay,
    layout,
    destroy: () => overlay.destroy(),
  };
}
