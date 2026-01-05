import type PhaserLib from "phaser";

import { getCombatReplay } from "../adapters/combatAdapter";
import { CombatEvent, CombatReplay, CombatUnitSnapshot } from "../types/combat";
import { EventQueue } from "../utils/EventQueue";

type PhaserModule = typeof import("phaser");

type BattleSceneOptions = {
  onBack?: () => void;
};

type UnitView = {
  spec: CombatUnitSnapshot;
  container: PhaserLib.GameObjects.Container;
  hpFill: PhaserLib.GameObjects.Rectangle;
  hpText: PhaserLib.GameObjects.Text;
  hpWidth: number;
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

export function createBattleScene(Phaser: PhaserModule, options: BattleSceneOptions = {}) {
  return class BattleScene extends Phaser.Scene {
    private backgroundLayers: PhaserLib.GameObjects.Rectangle[] = [];
    private units = new Map<string, UnitView>();
    private replay: CombatReplay | null = null;
    private stageLabel?: PhaserLib.GameObjects.Text;
    private hudSpeed?: { container: PhaserLib.GameObjects.Container; label: PhaserLib.GameObjects.Text };
    private hudAuto?: { container: PhaserLib.GameObjects.Container; label: PhaserLib.GameObjects.Text };
    private hudBack?: { container: PhaserLib.GameObjects.Container; label: PhaserLib.GameObjects.Text };
    private statusText?: PhaserLib.GameObjects.Text;
    private overlay?: PhaserLib.GameObjects.Text;
    private queue = new EventQueue<CombatEvent>({ baseDelayMs: 520 });
    private speed: 1 | 2 = 1;
    private autoEnabled = false;

    constructor() {
      super("battle");
    }

    create() {
      this.createBackground();
      this.layout(this.scale.gameSize);
      this.statusText = this.add.text(18, this.scale.height - 32, "Loading battle...", {
        fontFamily: "Chakra Petch, sans-serif",
        fontSize: "14px",
        color: "#cbd5e1",
      });

      const handleResize = (size: PhaserLib.Structs.Size) => {
        this.layout(size);
      };
      this.scale.on("resize", handleResize);
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        this.queue.clear();
        this.scale.off("resize", handleResize);
      });

      this.bootReplay();
    }

    private async bootReplay() {
      const replay = await getCombatReplay();
      if (!replay) {
        this.showEmpty();
        return;
      }
      this.replay = replay;
      this.statusText?.setText("Playing combat...");
      this.stageLabel = this.add.text(18, 16, `Stage ${replay.snapshot.stageLabel}`, {
        fontFamily: "Chakra Petch, sans-serif",
        fontSize: "20px",
        color: "#f8fafc",
      });

      this.createHud();
      this.buildUnits(replay.snapshot.units);
      this.layout(this.scale.gameSize);

      this.queue.start(async (evt) => {
        await this.processEvent(evt);
      });
      this.queue.enqueue(replay.events);
    }

    private showEmpty() {
      this.clearUnits();
      this.overlay = this.add.text(this.scale.width / 2, this.scale.height / 2, "No active battle.\nStart one from the hub.", {
        fontFamily: "Space Grotesk, sans-serif",
        fontSize: "20px",
        color: "#e2e8f0",
        align: "center",
      });
      this.overlay.setOrigin(0.5);
      this.statusText?.setText("No combat available");
    }

    private clearUnits() {
      this.units.forEach((u) => u.container.destroy());
      this.units.clear();
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

    private createHud() {
      const { width } = this.scale;
      this.hudSpeed = this.createHudButton(width - 140, 18, "Speed x1", () => {
        this.speed = this.speed === 1 ? 2 : 1;
        this.queue.setSpeed(this.speed);
        this.hudSpeed?.label.setText(`Speed x${this.speed}`);
      });

      this.hudAuto = this.createHudButton(width - 140, 62, "Auto Off", () => {
        this.autoEnabled = !this.autoEnabled;
        this.hudAuto?.label.setText(this.autoEnabled ? "Auto On" : "Auto Off");
      });

      this.hudBack = this.createHudButton(width - 140, 106, "Back", () => {
        if (options.onBack) {
          options.onBack();
          return;
        }
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

    private buildUnits(units: CombatUnitSnapshot[]) {
      this.clearUnits();
      units.forEach((unit) => {
        const view = this.createUnit(unit);
        this.units.set(unit.id, view);
      });
    }

    private createUnit(spec: CombatUnitSnapshot): UnitView {
      const container = this.add.container(0, 0);
      const tileWidth = 140;
      const tileHeight = 110;
      const color = spec.team === "ally" ? ALLY_COLOR : ENEMY_COLOR;

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

    const baseHpWidth = hpBg.width;
    const hpFill = this.add
      .rectangle(hpBg.x - baseHpWidth / 2, hpBg.y, baseHpWidth * (spec.hp / spec.maxHp), 10, HP_COLOR, 0.9)
      .setOrigin(0, 0.5);

      const hpText = this.add.text(hpBg.x, hpBg.y, `${Math.round((spec.hp / spec.maxHp) * 100)}%`, {
        fontFamily: "Chakra Petch, sans-serif",
        fontSize: "12px",
        color: "#b7ffe2",
      });
      hpText.setOrigin(0.5);

      container.add([tile, avatar, name, hpBg, hpFill, hpText]);

      if (spec.team === "enemy") {
        container.setAlpha(0.96);
      }

      return { spec: { ...spec }, container, hpFill, hpText, hpWidth: baseHpWidth };
    }

    private layout(size: PhaserLib.Structs.Size) {
      const { width, height } = size;
      this.layoutBackground(width, height);
      this.layoutUnits(width, height);
      this.layoutHud(width, height);
      if (this.overlay) {
        this.overlay.setPosition(width / 2, height / 2);
      }
      if (this.statusText) {
        this.statusText.setPosition(18, height - 32);
      }
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

    private slotPosition(team: "ally" | "enemy", slotIndex: number, width: number, height: number) {
      const centerY = height * 0.55;
      const xBase = team === "ally" ? width * 0.22 : width * 0.78;
      const yOffsets = [-110, -55, 0, 55, 110];
      const clampedSlot = Math.max(0, Math.min(4, slotIndex));
      const y = centerY + yOffsets[clampedSlot];
      const x = team === "ally" ? xBase + clampedSlot * 8 : xBase - clampedSlot * 8;
      const scale = Math.max(0.78, Math.min(1, width / 1100));
      return { x, y, scale };
    }

    private layoutUnits(width: number, height: number) {
      this.units.forEach((unit) => {
        const pos = this.slotPosition(unit.spec.team, unit.spec.slotIndex, width, height);
        unit.container.setPosition(pos.x, pos.y);
        unit.container.setScale(pos.scale);
      });
    }

    private layoutHud(width: number, _height: number) {
      this.stageLabel?.setPosition(18, 16);
      const right = width - 140;
      this.hudSpeed?.container.setPosition(right, 18);
      this.hudAuto?.container.setPosition(right, 62);
      this.hudBack?.container.setPosition(right, 106);
    }

    private async processEvent(evt: CombatEvent) {
      switch (evt.type) {
        case "attack": {
          await this.animateAttack(evt.sourceId, evt.targetId);
          break;
        }
        case "hit":
        case "crit": {
          this.applyDelta(evt.targetId, -evt.value);
          break;
        }
        case "heal": {
          this.applyDelta(evt.targetId, evt.value);
          break;
        }
        case "death": {
          this.fadeOut(evt.targetId);
          break;
        }
        case "stage_end": {
          this.queue.pause();
          this.showResult(evt.result);
          break;
        }
        default:
          break;
      }
    }

    private applyDelta(targetId: string, delta: number) {
      const unit = this.units.get(targetId);
      if (!unit) return;
      const nextHp = Math.max(0, Math.min(unit.spec.maxHp, unit.spec.hp + delta));
      unit.spec.hp = nextHp;
      const ratio = unit.spec.maxHp > 0 ? nextHp / unit.spec.maxHp : 0;
      unit.hpFill.setSize(unit.hpWidth * ratio, unit.hpFill.height);
      unit.hpText.setText(`${Math.round(ratio * 100)}%`);
      if (nextHp <= 0) {
        this.fadeOut(targetId);
      }
    }

    private fadeOut(targetId: string) {
      const unit = this.units.get(targetId);
      if (!unit) return;
      this.tweens.add({
        targets: unit.container,
        alpha: 0.2,
        duration: 220,
        ease: Phaser.Math.Easing.Quadratic.InOut,
        onComplete: () => {
          unit.container.setVisible(false);
        },
      });
    }

    private animateAttack(sourceId: string, targetId: string) {
      const source = this.units.get(sourceId);
      const target = this.units.get(targetId);
      if (!source || !target) return Promise.resolve();

      const { x: sx, y: sy } = source.container;
      const { x: tx, y: ty } = target.container;
      const dashX = sx + (tx - sx) * 0.12;
      const dashY = sy + (ty - sy) * 0.12;

      return new Promise<void>((resolve) => {
        this.tweens.add({
          targets: source.container,
          x: dashX,
          y: dashY,
          yoyo: true,
          duration: 160,
          ease: Phaser.Math.Easing.Sine.InOut,
          onComplete: () => resolve(),
        });
      });
    }

    private showResult(result: "victory" | "defeat") {
      if (this.overlay) {
        this.overlay.destroy();
      }
      const text = this.add.text(this.scale.width / 2, this.scale.height * 0.3, result === "victory" ? "Victory" : "Defeat", {
        fontFamily: "Space Grotesk, sans-serif",
        fontSize: "28px",
        color: result === "victory" ? "#86ff78" : "#fda4af",
        align: "center",
      });
      text.setOrigin(0.5);
      this.overlay = text;
      this.statusText?.setText(`Result: ${result}`);
    }
  };
}
