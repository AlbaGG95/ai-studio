import type PhaserLib from "phaser";

import { getCombatReplay } from "../adapters/combatAdapter";
import { hitFlash, healFlash } from "../fx/HitFlash";
import { FloatingTextManager } from "../fx/FloatingText";
import { screenShake } from "../fx/ScreenShake";
import { createBattleEndOverlay, type BattleEndOverlay } from "../ui/BattleEndOverlay";
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

const BASE_CARD_WIDTH = 140;
const BASE_CARD_HEIGHT = 110;
const DEBUG_LAYOUT = false;

type FormationLayout = {
  battleArea: { x: number; y: number; width: number; height: number };
  allySlots: Array<{ x: number; y: number }>;
  enemySlots: Array<{ x: number; y: number }>;
  cardScale: number;
  cardWidth: number;
  cardHeight: number;
};

function computeFormationLayout(viewportWidth: number, viewportHeight: number): FormationLayout {
  const clamp = (min: number, max: number, value: number) => Math.min(max, Math.max(min, value));
  const topSafe = clamp(70, 120, Math.round(viewportHeight * 0.12));
  const bottomSafe = clamp(100, 170, Math.round(viewportHeight * 0.18));
  const sideSafe = clamp(90, 150, Math.round(viewportWidth * 0.12));

  const battleArea = {
    x: sideSafe,
    y: topSafe,
    width: Math.max(240, viewportWidth - sideSafe * 2),
    height: Math.max(240, viewportHeight - topSafe - bottomSafe),
  };

  const slotHeight = battleArea.height / 5;
  const cardScale = Math.min(1, slotHeight / BASE_CARD_HEIGHT);
  const cardWidth = BASE_CARD_WIDTH * cardScale;
  const cardHeight = BASE_CARD_HEIGHT * cardScale;

  const allyX = battleArea.x + cardWidth * 0.6;
  const enemyX = battleArea.x + battleArea.width - cardWidth * 0.6;

  const allySlots = Array.from({ length: 5 }).map((_, idx) => ({
    x: allyX,
    y: battleArea.y + slotHeight * (idx + 0.5),
  }));
  const enemySlots = Array.from({ length: 5 }).map((_, idx) => ({
    x: enemyX,
    y: battleArea.y + slotHeight * (idx + 0.5),
  }));

  return { battleArea, allySlots, enemySlots, cardScale, cardWidth, cardHeight };
}

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
    private overlayCard?: BattleEndOverlay;
    private floats!: FloatingTextManager;
    private queue = new EventQueue<CombatEvent>({ baseDelayMs: 520 });
    private speed: 1 | 2 = 1;
    private autoEnabled = false;
    private layoutState?: FormationLayout;
    private debugRects: PhaserLib.GameObjects.Rectangle[] = [];

    constructor() {
      super("battle");
    }

    create() {
      this.createBackground();
      this.layout(this.scale.gameSize);
      this.floats = new FloatingTextManager(this);
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
        this.floats?.clear();
        this.overlayCard?.destroy();
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
      this.layoutState = computeFormationLayout(width, height);
      this.layoutBackground(width, height);
      this.layoutUnits(width, height);
      this.layoutHud(width, height);
      if (this.overlay) {
        this.overlay.setPosition(width / 2, height / 2);
      }
      if (this.overlayCard) {
        this.overlayCard.layout(width, height);
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

    private layoutUnits(width: number, height: number) {
      const layout = this.layoutState ?? computeFormationLayout(width, height);
      this.layoutState = layout;

      // Debug bounds
      if (this.debugRects.length) {
        this.debugRects.forEach((r) => r.destroy());
        this.debugRects = [];
      }
      if (DEBUG_LAYOUT) {
        const bounds = this.add
          .rectangle(
            layout.battleArea.x + layout.battleArea.width / 2,
            layout.battleArea.y + layout.battleArea.height / 2,
            layout.battleArea.width,
            layout.battleArea.height,
            0x00ffff,
            0.08
          )
          .setOrigin(0.5);
        bounds.setStrokeStyle(1, 0x00ffff, 0.4);
        bounds.setDepth(1);
        this.debugRects.push(bounds);
        [...layout.allySlots, ...layout.enemySlots].forEach((slot) => {
          const rect = this.add
            .rectangle(slot.x, slot.y, layout.cardWidth, layout.cardHeight, 0x00ff00, 0.1)
            .setOrigin(0.5);
          rect.setStrokeStyle(1, 0x00ff00, 0.6);
          rect.setDepth(1);
          this.debugRects.push(rect);
        });
      }

      this.units.forEach((unit) => {
        const slotIdx = Math.max(0, Math.min(4, unit.spec.slotIndex));
        const pos = unit.spec.team === "ally" ? layout.allySlots[slotIdx] : layout.enemySlots[slotIdx];
        unit.container.setPosition(pos.x, pos.y);
        unit.container.setScale(layout.cardScale);
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
          this.spawnFloat(evt.type, evt.targetId, evt.value);
          this.flashTarget(evt.targetId, evt.type === "crit");
          if (evt.type === "crit") {
            screenShake(this, 0.006, 140, this.speed);
          }
          break;
        }
        case "heal": {
          this.applyDelta(evt.targetId, evt.value);
          this.spawnFloat("heal", evt.targetId, evt.value);
          this.healPulse(evt.targetId);
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
      const sx = unit.container.scaleX || 1;
      const sy = unit.container.scaleY || 1;
      this.tweens.add({
        targets: unit.container,
        alpha: 0.2,
        y: unit.container.y + 12,
        scaleX: sx * 0.9,
        scaleY: sy * 0.9,
        duration: Math.max(180, Math.round(260 / this.speed)),
        ease: "Quad.easeInOut",
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
          duration: Math.max(90, Math.round(160 / this.speed)),
          ease: "Sine.easeInOut",
          onComplete: () => resolve(),
        });
      });
    }

    private showResult(result: "victory" | "defeat") {
      this.overlay?.destroy();
      this.overlayCard?.destroy();

      const goBack = () => {
        if (options.onBack) {
          options.onBack();
          return;
        }
        if (typeof window !== "undefined") {
          const target = "/afk/map";
          window.location.href = target;
        }
      };

      this.overlayCard = createBattleEndOverlay(this, {
        onContinue: goBack,
        result,
        width: this.scale.width,
        height: this.scale.height,
      });
      this.statusText?.setText(`Result: ${result}`);
    }

    private spawnFloat(kind: "hit" | "crit" | "heal", targetId: string, value: number) {
      const unit = this.units.get(targetId);
      if (!unit) return;
      const pos = unit.container;
      this.floats.spawn(kind, Math.round(value), targetId, pos.x, pos.y - 24, this.speed);
    }

    private flashTarget(targetId: string, isCrit: boolean) {
      const unit = this.units.get(targetId);
      if (!unit) return;
      hitFlash(this, unit.container, { shake: true, speed: this.speed, duration: isCrit ? 160 : 120 });
    }

    private healPulse(targetId: string) {
      const unit = this.units.get(targetId);
      if (!unit) return;
      healFlash(this, unit.container, this.speed);
    }
  };
}
