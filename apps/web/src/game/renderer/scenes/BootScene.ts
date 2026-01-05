import type PhaserLib from "phaser";

export function createBootScene(Phaser: typeof PhaserLib) {
  return class BootScene extends Phaser.Scene {
    constructor() {
      super("boot");
    }

    create() {
      const { width, height } = this.scale;
      this.cameras.main.setBackgroundColor("#0b1222");

      const text = this.add.text(width / 2, height / 2, "Renderer OK", {
        fontFamily: "Space Grotesk, sans-serif",
        fontSize: "28px",
        color: "#6cf6ff",
      });
      text.setOrigin(0.5);

      const underline = this.add.rectangle(width / 2, height / 2 + 28, 200, 2, 0x6cf6ff, 0.28);
      underline.setOrigin(0.5);

      const handleResize = (gameSize: Phaser.Structs.Size) => {
        const { width: w, height: h } = gameSize;
        this.cameras.main.setSize(w, h);
        text.setPosition(w / 2, h / 2);
        underline.setPosition(w / 2, h / 2 + 28);
      };

      this.scale.on("resize", handleResize);
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        this.scale.off("resize", handleResize);
      });
    }
  };
}
