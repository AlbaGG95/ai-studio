import type PhaserLib from "phaser";

type PhaserModule = typeof import("phaser");

type UnitSide = "ally" | "enemy";

type UnitSpec = {
  id: string;
  name: string;
  side: UnitSide;
  hp: number;
  maxHp: number;
};

type UnitView = {
  spec: UnitSpec;
  container: PhaserLib.GameObjects.Container;
  hpFill: PhaserLib.GameObjects.Rectangle;
  slot: PhaserLib.GameObjects.Rectangle;
};

const ALLY_COLOR = 0x7ce4ff;
const ENEMY_COLOR = 0xffb86c;
const HP_COLOR = 0x4ade80;
const HP_BG = 0x0f172a;
const TILE_BG = 0x0b1222;
const TILE_BORDER = 0x1f2b46;
const SKY = 0x0a1226;
const MID = 0x0c172d;
const GROUND = 0x0a1322;

const MOCK_ALLIES: UnitSpec[] = [
  { id: "a1", name: "Nova", side: "ally", hp: 820, maxHp: 1000 },
  { id: "a2", name: "Rook", side: "ally", hp: 640, maxHp: 900 },
  { id: "a3", name: "Vex", side: "ally", hp: 540, maxHp: 800 },
  { id: "a4", name: "Mina", side: "ally", hp: 720, maxHp: 950 },
  { id: "a5", name: "Flux", side: "ally", hp: 910, maxHp: 1100 },
];

const MOCK_ENEMIES: UnitSpec[] = [
  { id: "e1", name: "Shade", side: "enemy", hp: 760, maxHp: 1000 },
  { id: "e2", name: "Grit", side: "enemy", hp: 520, maxHp: 850 },
  { id: "e3", name: "Pyre", side: "enemy", hp: 680, maxHp: 950 },
  { id: "e4", name: "Hex", side: "enemy", hp: 800, maxHp: 1020 },
  { id: "e5", name: "Fang", side: "enemy", hp: 600, maxHp: 870 },
];

export function createBattleScene(Phaser: PhaserModule) {
  return class BattleScene extends Phaser.Scene {
    private backgroundLayers: PhaserLib.GameObjects.Rectangle[] = [];
    private units: UnitView[] = [];
    private stageLabel?: PhaserLib.GameObjects.Text;
    private speedButton?: { container: PhaserLib.GameObjects.Container; label: PhaserLib.GameObjects.Text };
    private autoButton?: { container: PhaserLib.GameObjects.Container; label: PhaserLib.GameObjects.Text };
    private backButton?: { container: PhaserLib.GameObjects.Container; label: PhaserLib.GameObjects.Text };
    private speedMode: 1 | 2 = 1;
    private autoEnabled = false;

    constructor() {
      super("battle");
    }

    create() {
      this.createBackground();
      this.createUnits();
      this.createHud();
      this.layout(this.scale.gameSize);

      const handleResize = (size: PhaserLib.Structs.Size) => {
        this.layout(size);
      };

      this.scale.on("resize", handleResize);
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        this.scale.off("resize", handleResize);
      });
    }

    private createBackground() {
      const { width, height } = this.scale;
      const sky = this.add.rectangle(0, 0, width, height * 0.6, SKY, 1).setOrigin(0, 0);
      const mid = this.add.rectangle(0, height * 0.35, width, height * 0.4, MID, 1).setOrigin(0, 0);
      const ground = this.add.rectangle(0, height * 0.65, width, height * 0.35, GROUND, 1).setOrigin(0, 0);
      sky.setAlpha(0.9);
      mid.setAlpha(0.92);
      ground.setAlpha(0.96);
      this.backgroundLayers = [sky, mid, ground];
    }

    private createUnits() {
      const allUnits = [...MOCK_ALLIES, ...MOCK_ENEMIES];
      this.units = allUnits.map((spec) => this.createUnitSlot(spec));
    }

    private createUnitSlot(spec: UnitSpec): UnitView {
      const container = this.add.container(0, 0);
      const tileWidth = 140;
      const tileHeight = 110;
      const color = spec.side === "ally" ? ALLY_COLOR : ENEMY_COLOR;

      const tile = this.add.rectangle(0, 0, tileWidth, tileHeight, TILE_BG, 0.9);
      tile.setStrokeStyle(2, TILE_BORDER, 0.8);
      tile.setOrigin(0.5);

      const avatar = this.add.circle(-tileWidth * 0.24, -8, 28, color, 0.8);
      avatar.setStrokeStyle(3, color, 0.9);

      const name = this.add.text(tileWidth * 0.02, -20, spec.name, {
        fontFamily: "Space Grotesk, sans-serif",
        fontSize: "16px",
        color: "#dbeafe",
      });
      name.setOrigin(0, 0.5);

      const hpBg = this.add.rectangle(0, tileHeight * 0.2, tileWidth * 0.7, 12, HP_BG, 0.9).setOrigin(0.5);
      hpBg.setStrokeStyle(1, TILE_BORDER, 0.8);

      const hpFill = this.add
        .rectangle(hpBg.x - hpBg.width / 2, hpBg.y, hpBg.width * (spec.hp / spec.maxHp), 10, HP_COLOR, 0.9)
        .setOrigin(0, 0.5);

      const hpText = this.add.text(hpBg.x, hpBg.y, `${Math.round((spec.hp / spec.maxHp) * 100)}%`, {
        fontFamily: "Chakra Petch, sans-serif",
        fontSize: "12px",
        color: "#b7ffe2",
      });
      hpText.setOrigin(0.5);

      container.add([tile, avatar, name, hpBg, hpFill, hpText]);

      if (spec.side === "enemy") {
        container.setAlpha(0.96);
      }

      return { spec, container, hpFill, slot: tile };
    }

    private createHud() {
      const { width } = this.scale;
      this.stageLabel = this.add.text(18, 16, "Stage 1-1", {
        fontFamily: "Chakra Petch, sans-serif",
        fontSize: "20px",
        color: "#f8fafc",
      });

      this.speedButton = this.createHudButton(width - 120, 18, "Speed x1", () => {
        this.speedMode = this.speedMode === 1 ? 2 : 1;
        this.speedButton?.label.setText(`Speed x${this.speedMode}`);
      });

      this.autoButton = this.createHudButton(width - 120, 62, "Auto Off", () => {
        this.autoEnabled = !this.autoEnabled;
        this.autoButton?.label.setText(this.autoEnabled ? "Auto On" : "Auto Off");
      });

      this.backButton = this.createHudButton(width - 120, 106, "Back", () => {
        if (typeof window !== "undefined") {
          window.location.href = "/afk/renderer";
        }
      });
    }

    private createHudButton(x: number, y: number, label: string, onClick: () => void) {
      const container = this.add.container(x, y);
      const btnBg = this.add.rectangle(0, 0, 120, 34, 0x111a2c, 0.9).setOrigin(0, 0);
      btnBg.setStrokeStyle(1, TILE_BORDER, 0.8);
      btnBg.setInteractive({ useHandCursor: true });
      const text = this.add.text(60, 17, label, {
        fontFamily: "Chakra Petch, sans-serif",
        fontSize: "14px",
        color: "#e2e8f0",
      });
      text.setOrigin(0.5);

      btnBg.on("pointerover", () => btnBg.setFillStyle(0x16233a, 0.95));
      btnBg.on("pointerout", () => btnBg.setFillStyle(0x111a2c, 0.9));
      btnBg.on("pointerup", () => onClick());

      container.add([btnBg, text]);
      return { container, label: text };
    }

    private layout(size: PhaserLib.Structs.Size) {
      const { width, height } = size;
      this.layoutBackground(width, height);
      this.layoutUnits(width, height);
      this.layoutHud(width, height);
    }

    private layoutBackground(width: number, height: number) {
      const [sky, mid, ground] = this.backgroundLayers;
      if (!sky || !mid || !ground) return;
      sky.setSize(width, height * 0.6);
      mid.setPosition(0, height * 0.35);
      mid.setSize(width, height * 0.4);
      ground.setPosition(0, height * 0.65);
      ground.setSize(width, height * 0.35);
    }

    private layoutUnits(width: number, height: number) {
      const centerY = height * 0.55;
      const gapX = Math.min(160, width * 0.16);
      const gapY = 90;

      const allyPositions = [
        { x: width * 0.22 - gapX * 0.3, y: centerY - gapY * 0.6 },
        { x: width * 0.22 + gapX * 0.2, y: centerY - gapY * 0.2 },
        { x: width * 0.22 - gapX * 0.4, y: centerY + gapY * 0.3 },
        { x: width * 0.22 + gapX * 0.2, y: centerY + gapY * 0.7 },
        { x: width * 0.22 + gapX * 0.6, y: centerY + gapY * 0.1 },
      ];

      const enemyPositions = [
        { x: width * 0.78 + gapX * 0.3, y: centerY - gapY * 0.6 },
        { x: width * 0.78 - gapX * 0.2, y: centerY - gapY * 0.2 },
        { x: width * 0.78 + gapX * 0.4, y: centerY + gapY * 0.3 },
        { x: width * 0.78 - gapX * 0.2, y: centerY + gapY * 0.7 },
        { x: width * 0.78 - gapX * 0.6, y: centerY + gapY * 0.1 },
      ];

      const tileScale = Math.max(0.8, Math.min(1, width / 1000));

      let allyIdx = 0;
      let enemyIdx = 0;

      this.units.forEach((unit) => {
        const isAlly = unit.spec.side === "ally";
        const position = isAlly ? allyPositions[allyIdx++] : enemyPositions[enemyIdx++];
        unit.container.setPosition(position.x, position.y);
        unit.container.setScale(isAlly ? tileScale : tileScale);
        unit.slot.setStrokeStyle(2, TILE_BORDER, isAlly ? 0.9 : 0.7);
      });
    }

    private layoutHud(width: number, height: number) {
      this.stageLabel?.setPosition(18, 16);
      const right = width - 134;
      this.speedButton?.container.setPosition(right, 18);
      this.autoButton?.container.setPosition(right, 62);
      this.backButton?.container.setPosition(right, 106);
    }
  };
}
