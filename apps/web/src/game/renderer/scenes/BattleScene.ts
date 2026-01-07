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
  stageId?: string;
  onBack?: () => void;
  onBattleEnd?: (payload: { stageId: string; result: "victory" | "defeat" }) => void;
  onContinue?: () => void;
};

type DepthBlob = {
  shape: PhaserLib.GameObjects.Arc;
  baseX: number;
  baseY: number;
  amp: number;
  speed: number;
};

type DustParticle = {
  shape: PhaserLib.GameObjects.Arc;
  sway: number;
  speed: number;
  phase: number;
};

type UnitView = {
  spec: CombatUnitSnapshot;
  container: PhaserLib.GameObjects.Container;
  visual: PhaserLib.GameObjects.Container;
  hpFill: PhaserLib.GameObjects.Rectangle;
  hpText: PhaserLib.GameObjects.Text;
  hpWidth: number;
  idle: { bobPhase: number; scalePhase: number; bobAmp: number; scaleAmp: number };
  stagger: { x: number; y: number; scale: number; depth: number };
  motionOffset: { x: number; y: number; scaleX: number; scaleY: number };
  hitImpact: { scale: number; x: number; y: number };
  pressureOffset: { x: number; y: number };
  anticipationTween?: PhaserLib.Tweens.Tween;
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
const STAGE_BAND = 0x111a2c;

const BASE_CARD_WIDTH = 140;
const BASE_CARD_HEIGHT = 110;
const DEBUG_LAYOUT = false;
const DEBUG_STAGE = false;
const ENABLE_IDLE_MOTION = true;
const ENABLE_FORMATION_STAGGER = true;
const ENABLE_ATTACK_ANTICIPATION = true;
const ENABLE_HIT_STOP = true;
const ENABLE_TRAJECTORY_FX = true;
const DEBUG_FX = false;
const DEBUG_LANE_PRESSURE = false;
const VISUAL_SIDE_OFFSET = 4;
const CENTER_PROTAG_SCALE = 1.07;
const FRONT_SCALE = 1.02;
const BACK_SCALE = 0.98;
const FRONT_LEAN_X = 5;
const BACK_LEAN_X = -4;
const BOB_FRONT_MULT = 1.08;
const BOB_CENTER_MULT = 1.15;
const BOB_BACK_MULT = 0.94;
const STAGGER_X = { back: 10, mid: 0, front: 12 };
const STAGGER_Y = { back: -6, mid: 0, front: 6 };
const STAGGER_SCALE = { back: 0.96, mid: 1, front: 1.04 };

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

  const rows = 5;
  const usableHeight = battleArea.height * 0.85;
  const startY = battleArea.y + (battleArea.height - usableHeight) / 2;
  const slotHeight = usableHeight / rows;
  const maxScaleByHeight = (slotHeight * 0.9) / BASE_CARD_HEIGHT;
  const maxScaleByWidth = (battleArea.width * 0.42) / BASE_CARD_WIDTH;
  const rawScale = Math.min(maxScaleByHeight, maxScaleByWidth, 1.15);
  const cardScale = clamp(0.9, 1.15, rawScale);
  const cardWidth = BASE_CARD_WIDTH * cardScale;
  const cardHeight = BASE_CARD_HEIGHT * cardScale;

  const formationCenterX = battleArea.x + battleArea.width / 2;
  const columnSeparation = clamp(260, battleArea.width * 0.5, 500);
  const allyX = formationCenterX - columnSeparation / 2;
  const enemyX = formationCenterX + columnSeparation / 2;

  const allySlots = Array.from({ length: rows }).map((_, idx) => ({
    x: allyX,
    y: startY + slotHeight * (idx + 0.5),
  }));
  const enemySlots = Array.from({ length: rows }).map((_, idx) => ({
    x: enemyX,
    y: startY + slotHeight * (idx + 0.5),
  }));

  return { battleArea, allySlots, enemySlots, cardScale, cardWidth, cardHeight };
}

export function createBattleScene(Phaser: PhaserModule, options: BattleSceneOptions = {}) {
  return class BattleScene extends Phaser.Scene {
    private bgRoot!: PhaserLib.GameObjects.Container;
    private stageRoot!: PhaserLib.GameObjects.Container;
    private unitRoot!: PhaserLib.GameObjects.Container;
    private fxRoot!: PhaserLib.GameObjects.Container;
    private trajectoryLayer!: PhaserLib.GameObjects.Container;
    private backgroundLayers: PhaserLib.GameObjects.Rectangle[] = [];
    private stageBlobs: DepthBlob[] = [];
    private dustParticles: DustParticle[] = [];
    private groundBandRect?: { x: number; y: number; width: number; height: number };
    private centerPulse?: PhaserLib.GameObjects.Graphics;
    private activeProjectiles: PhaserLib.GameObjects.GameObject[] = [];
    private activeSlashes: PhaserLib.GameObjects.GameObject[] = [];
    private pressureMarkers: PhaserLib.GameObjects.Graphics[] = [];
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
    private stageId: string = "1-1";
    private battleFinished = false;
    private layoutState?: FormationLayout;
    private debugRects: PhaserLib.GameObjects.GameObject[] = [];
    private isHitStop = false;
    private hitStopTimer?: PhaserLib.Time.TimerEvent;
    private prevTweenScale = 1;

    constructor() {
      super("battle");
    }

    create() {
      this.bgRoot = this.add.container(0, 0).setDepth(0);
      this.stageRoot = this.add.container(0, 0).setDepth(1);
      this.unitRoot = this.add.container(0, 0).setDepth(2);
      this.fxRoot = this.add.container(0, 0).setDepth(3);
      this.trajectoryLayer = this.add.container(0, 0).setDepth(1.5);
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
      const replay = await getCombatReplay({ stageId: options.stageId });
      if (!replay) {
        this.showEmpty();
        return;
      }
      this.replay = replay;
      this.battleFinished = false;
      this.stageId = replay.snapshot.stageLabel;
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
      this.bgRoot.add(this.backgroundLayers);
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
      const visual = this.add.container(0, 0);
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

      visual.add([tile, avatar, name, hpBg, hpFill, hpText]);

      container.add(visual);

      if (spec.team === "enemy") {
        container.setAlpha(0.96);
      }

      const phaseSeed = spec.slotIndex * 17 + (spec.team === "ally" ? 11 : 23) + [...spec.id].reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
      const bobAmp = 2.6 + ((phaseSeed % 15) / 10);
      const scaleAmp = 0.01 + ((phaseSeed % 6) / 1000);
      const idle = { bobPhase: phaseSeed * 0.17, scalePhase: phaseSeed * 0.11, bobAmp, scaleAmp };

       const tierOrder: Array<"back" | "mid" | "front"> = ["back", "mid", "front", "mid", "back"];
       const tier = tierOrder[spec.slotIndex % tierOrder.length];
       const dir = spec.team === "enemy" ? -1 : 1;
       const stagger = {
         x: dir * (tier === "back" ? -STAGGER_X.back : tier === "front" ? STAGGER_X.front : STAGGER_X.mid),
         y: tier === "back" ? STAGGER_Y.back : tier === "front" ? STAGGER_Y.front : STAGGER_Y.mid,
         scale: tier === "back" ? STAGGER_SCALE.back : tier === "front" ? STAGGER_SCALE.front : STAGGER_SCALE.mid,
         depth: tier === "front" ? 3 : tier === "mid" ? 2 : 1,
       };
      visual.setDepth(stagger.depth);
      visual.setPosition(stagger.x, stagger.y);
      visual.setScale(stagger.scale);

      this.unitRoot.add(container);
      return {
        spec: { ...spec },
        container,
        visual,
        hpFill,
        hpText,
        hpWidth: baseHpWidth,
        idle,
        stagger,
        motionOffset: { x: 0, y: 0, scaleX: 1, scaleY: 1 },
        hitImpact: { scale: 1, x: 0, y: 0 },
        pressureOffset: { x: 0, y: 0 },
      };
    }

    private layout(size: PhaserLib.Structs.Size) {
      const { width, height } = size;
      this.layoutState = computeFormationLayout(width, height);
      this.layoutBackground(width, height);
      this.layoutStage();
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

    private layoutStage() {
      const layout = this.layoutState;
      if (!layout) return;
      const area = layout.battleArea;

      this.stageRoot.removeAll(true);
      this.stageBlobs = [];
      this.dustParticles = [];
      this.groundBandRect = undefined;

      const bandWidth = area.width * 0.9;
      const bandHeight = area.height * 0.55;
      const bandX = area.x + (area.width - bandWidth) / 2;
      const bandY = area.y + area.height * 0.4;
      this.groundBandRect = { x: bandX, y: bandY, width: bandWidth, height: bandHeight };

      const band = this.add.graphics();
      band.fillStyle(STAGE_BAND, 0.34);
      band.fillRoundedRect(bandX, bandY, bandWidth, bandHeight, 18);
      band.fillStyle(0x1c2940, 0.18);
      band.fillRoundedRect(bandX + 10, bandY + 8, bandWidth - 20, bandHeight * 0.52, 14);
      band.lineStyle(2, 0x5eead4, 0.08);
      band.strokeRoundedRect(bandX + 6, bandY + 6, bandWidth - 12, bandHeight - 12, 14);
      this.stageRoot.add(band);

      const stripes = this.add.graphics();
      const stripeCount = 5;
      for (let i = 0; i < stripeCount; i += 1) {
        const t = i / (stripeCount - 1);
        const y = bandY + bandHeight * 0.25 + bandHeight * 0.55 * t;
        const alpha = 0.06 - t * 0.015;
        stripes.lineStyle(1.6, 0xffffff, alpha);
        stripes.beginPath();
        stripes.moveTo(bandX + 12, y);
        stripes.lineTo(bandX + bandWidth - 12, y);
        stripes.strokePath();
      }
      stripes.setAlpha(0.8);
      this.stageRoot.add(stripes);

      const vignette = this.add.graphics();
      const vgAlpha = 0.06;
      vignette.fillStyle(0x030712, vgAlpha);
      vignette.fillRect(area.x, area.y, 16, area.height);
      vignette.fillRect(area.x + area.width - 16, area.y, 16, area.height);
      vignette.fillRect(area.x, area.y, area.width, 12);
      vignette.fillRect(area.x, area.y + area.height - 12, area.width, 12);
      this.stageRoot.add(vignette);

      const centerGlow = this.add.graphics();
      const glowWidth = bandWidth * 0.35;
      const glowHeight = bandHeight * 0.5;
      centerGlow.fillStyle(0x1f2937, 0.12);
      centerGlow.fillRoundedRect(
        bandX + (bandWidth - glowWidth) / 2,
        bandY + (bandHeight - glowHeight) / 2,
        glowWidth,
        glowHeight,
        20
      );
      this.stageRoot.add(centerGlow);
      this.centerPulse = centerGlow;

      const blobCount = 3;
      for (let i = 0; i < blobCount; i += 1) {
        const radius = bandWidth * 0.18;
        const baseX = bandX + bandWidth * (0.25 + 0.25 * i);
        const baseY = bandY + bandHeight * (0.35 + 0.1 * i);
        const shape = this.add.circle(baseX, baseY, radius, 0x0f172a, 0.04);
        this.stageRoot.add(shape);
        this.stageBlobs.push({
          shape,
          baseX,
          baseY,
          amp: 12 + i * 6,
          speed: 0.2 + i * 0.08,
        });
      }

      const dustCount = 18;
      for (let i = 0; i < dustCount; i += 1) {
        const radius = 1.2 + Math.random() * 1.6;
        const cx = bandX + Math.random() * bandWidth;
        const cy = bandY + Math.random() * bandHeight;
        const particle = this.add.circle(cx, cy, radius, 0xffffff, 0.08);
        this.stageRoot.add(particle);
        this.dustParticles.push({
          shape: particle,
          sway: 6 + Math.random() * 8,
          speed: 8 + Math.random() * 12,
          phase: Math.random() * Math.PI * 2,
        });
      }

      if (DEBUG_STAGE) {
        const debug = this.add.graphics();
        debug.lineStyle(1, 0x00ff00, 0.4);
        debug.strokeRect(area.x, area.y, area.width, area.height);
        debug.lineStyle(1, 0xffff00, 0.5);
        debug.strokeRect(bandX, bandY, bandWidth, bandHeight);
        this.stageRoot.add(debug);
      }
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
        layout.allySlots.forEach((slot) => {
          const line = this.add
            .rectangle(
              layout.battleArea.x + layout.battleArea.width / 2,
              slot.y,
              layout.battleArea.width,
              1,
              0x00ffff,
              0.2
            )
            .setOrigin(0.5);
          line.setDepth(1);
          this.debugRects.push(line);
        });
        [...layout.allySlots, ...layout.enemySlots].forEach((slot) => {
          const dot = this.add.circle(slot.x, slot.y, 3, 0x00ffff, 0.6);
          dot.setDepth(2);
          this.debugRects.push(dot);
        });
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
        this.applyVisualTransform(unit, this.time.now, true);
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
      this.spawnTrajectoryFx(evt.sourceId, evt.targetId, evt.type);
      this.playHitStop(evt.type === "crit" ? 60 : 45, evt.targetId);
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
          if (!this.battleFinished) {
            this.battleFinished = true;
            options.onBattleEnd?.({ stageId: this.stageId, result: evt.result });
          }
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
      if (unit.spec.slotIndex === 2) {
        this.playCenterDeathPulse();
      }
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
        this.playAttackAnticipation(source, target).finally(() => {
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
      });
    }

    private showResult(result: "victory" | "defeat") {
      this.overlay?.destroy();
      this.overlayCard?.destroy();

      const goBack = () => {
        if (options.onContinue) {
          options.onContinue();
          return;
        }
        if (options.onBack) {
          options.onBack();
          return;
        }
        if (typeof window !== "undefined") {
          window.location.href = "/afk/map";
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
      const visualOffsetY = unit.visual.y || 0;
      const visualOffsetX = unit.visual.x || 0;
      this.floats.spawn(kind, Math.round(value), targetId, pos.x + visualOffsetX, pos.y + visualOffsetY - 24, this.speed);
    }

    private flashTarget(targetId: string, isCrit: boolean) {
      const unit = this.units.get(targetId);
      if (!unit) return;
      const centerBoost = unit.spec.slotIndex === 2 ? 1.15 : 1;
      hitFlash(this, unit.visual, {
        shake: true,
        speed: this.speed,
        duration: Math.round((isCrit ? 160 : 120) * centerBoost),
      });
    }

    private healPulse(targetId: string) {
      const unit = this.units.get(targetId);
      if (!unit) return;
      healFlash(this, unit.visual, this.speed);
    }

    update(_time: number, delta: number) {
      const dt = delta / 1000;
      const time = this.time.now;
      if (this.isHitStop) return;

      this.updatePressure(time / 1000);

      this.stageBlobs.forEach((blob) => {
        const offset = Math.sin(time * 0.00035 * blob.speed) * blob.amp;
        blob.shape.setPosition(blob.baseX + offset, blob.baseY + offset * 0.3);
      });

      if (this.groundBandRect) {
        const { x, y, width, height } = this.groundBandRect;
        this.dustParticles.forEach((p) => {
          const swayOffset = Math.sin(time * 0.001 + p.phase) * p.sway * dt;
          const nextX = p.shape.x + swayOffset;
          const nextY = p.shape.y - p.speed * dt;
          let wrappedX = nextX;
          let wrappedY = nextY;
          if (nextY < y - 6) {
            wrappedY = y + height + 6;
          } else if (nextY > y + height + 6) {
            wrappedY = y - 6;
          }
          if (nextX < x - 6) {
            wrappedX = x + width + 6;
          } else if (nextX > x + width + 6) {
            wrappedX = x - 6;
          }
          p.shape.setPosition(wrappedX, wrappedY);
        });
      }

      this.units.forEach((unit) => this.applyVisualTransform(unit, time, false));
    }

    private applyVisualTransform(unit: UnitView, time: number, forceDepth: boolean) {
      const baseX =
        (ENABLE_FORMATION_STAGGER ? unit.stagger.x : 0) + (unit.spec.team === "ally" ? -VISUAL_SIDE_OFFSET : VISUAL_SIDE_OFFSET);
      const baseY = ENABLE_FORMATION_STAGGER ? unit.stagger.y : 0;
      const tier = unit.spec.slotIndex <= 1 ? "front" : unit.spec.slotIndex === 2 ? "center" : "back";
      const centerDir = unit.spec.team === "ally" ? 1 : -1;
      const tierLean =
        tier === "front"
          ? centerDir * FRONT_LEAN_X
          : tier === "back"
          ? -centerDir * Math.abs(BACK_LEAN_X)
          : 0;
      const tierScale = tier === "front" ? FRONT_SCALE : tier === "back" ? BACK_SCALE : CENTER_PROTAG_SCALE;
      const baseScale = (ENABLE_FORMATION_STAGGER ? unit.stagger.scale : 1) * tierScale;
      const pressure = unit.pressureOffset;
      const bobFreq = 0.0019;
      const scaleFreq = 0.0012;
      const bobStrength = tier === "front" ? BOB_FRONT_MULT : tier === "back" ? BOB_BACK_MULT : BOB_CENTER_MULT;
      const bob = ENABLE_IDLE_MOTION ? Math.sin(time * bobFreq + unit.idle.bobPhase) * unit.idle.bobAmp * bobStrength : 0;
      const breathe = ENABLE_IDLE_MOTION ? 1 + Math.sin(time * scaleFreq + unit.idle.scalePhase) * unit.idle.scaleAmp * bobStrength : 1;
      const offset = unit.motionOffset;
      const impact = unit.hitImpact;
      unit.visual.setPosition(
        baseX + tierLean + offset.x + impact.x + pressure.x,
        baseY + bob + offset.y + impact.y + pressure.y
      );
        unit.visual.setScale(
        baseScale * breathe * offset.scaleX * impact.scale,
        baseScale * breathe * offset.scaleY * impact.scale
      );
      if (forceDepth || ENABLE_FORMATION_STAGGER) {
        unit.visual.setDepth(unit.stagger.depth);
      }
    }

    private playHitStop(durationMs: number, targetId?: string) {
      if (!ENABLE_HIT_STOP) return;
      this.hitStopTimer?.destroy();
      const target = targetId ? this.units.get(targetId) : undefined;
      this.isHitStop = true;
      this.prevTweenScale = this.tweens.timeScale ?? 1;
      this.tweens.timeScale = 0;

      if (target) {
        const baseImpact = durationMs >= 60 ? 0.93 : 0.95;
        const compress = 1 - baseImpact;
        const centerBoost = target.spec.slotIndex === 2 ? 1.15 : 1;
        const impactScale = 1 - compress * centerBoost;
        const impactX = (Math.random() > 0.5 ? 1 : -1) * (durationMs >= 60 ? 3 : 2);
        target.hitImpact.scale = impactScale;
        target.hitImpact.x = impactX;
        target.hitImpact.y = 0;
        this.applyVisualTransform(target, this.time.now, false);
    }

      const dur = Math.max(25, Math.round(durationMs / this.speed));
      this.hitStopTimer = this.time.delayedCall(dur, () => {
        this.isHitStop = false;
        this.tweens.timeScale = this.prevTweenScale || 1;
        if (target) {
          target.hitImpact.scale = 1;
          target.hitImpact.x = 0;
          target.hitImpact.y = 0;
          this.applyVisualTransform(target, this.time.now, false);
        }
      });
    }

    private playAttackAnticipation(attacker: UnitView, target: UnitView) {
      if (!ENABLE_ATTACK_ANTICIPATION) return Promise.resolve();
      attacker.anticipationTween?.stop();
      attacker.motionOffset.x = 0;
      attacker.motionOffset.y = 0;
      attacker.motionOffset.scaleX = 1;
      attacker.motionOffset.scaleY = 1;
      const dx = target.container.x - attacker.container.x;
      const dir = dx === 0 ? (attacker.spec.team === "ally" ? 1 : -1) : Math.sign(dx);
      const tier = attacker.spec.slotIndex <= 1 ? "front" : attacker.spec.slotIndex === 2 ? "center" : "back";
      const tierLean = tier === "front" ? 2 : tier === "back" ? -2 : 0;
      const tierScale = tier === "front" ? 1.03 : tier === "center" ? 1.05 : 0.98;
      const baseX = dir * (12 + tierLean);
      const baseY = -2;
      const scaleX = 1.05 * tierScale;
      const scaleY = 0.97;
      const windUp = Math.max(100, Math.round(150 / this.speed));
      const snap = Math.max(70, Math.round(110 / this.speed));
      return new Promise<void>((resolve) => {
        const upTween = this.tweens.add({
          targets: attacker.motionOffset,
          x: baseX,
          y: baseY,
          scaleX,
          scaleY,
          duration: windUp,
          ease: "Quad.easeOut",
          onUpdate: () => this.applyVisualTransform(attacker, this.time.now, false),
          onComplete: () => {
            attacker.anticipationTween = this.tweens.add({
              targets: attacker.motionOffset,
              x: 0,
              y: 0,
              scaleX: 1,
              scaleY: 1,
              duration: snap,
              ease: "Quad.easeIn",
              onUpdate: () => this.applyVisualTransform(attacker, this.time.now, false),
              onComplete: () => {
                attacker.anticipationTween = undefined;
                resolve();
              },
            });
          },
        });
        attacker.anticipationTween = upTween;
      });
    }

    private getUnitWorldPoint(unitId: string) {
      const unit = this.units.get(unitId);
      if (!unit) return null;
      // Apply current visual offsets to derive world point consistent with FX anchoring.
      const x = unit.container.x + unit.visual.x;
      const y = unit.container.y + unit.visual.y;
      return { x, y };
    }

    private isRangedUnit(unit: UnitView) {
      return unit.spec.slotIndex >= 3;
    }

    private spawnTrajectoryFx(attackerId: string | undefined, targetId: string | undefined, kind: "hit" | "crit") {
      if (!ENABLE_TRAJECTORY_FX) return;
      if (!attackerId || !targetId) return;
      const attacker = this.units.get(attackerId);
      const target = this.units.get(targetId);
      if (!attacker || !target) return;
      const from = this.getUnitWorldPoint(attackerId);
      const to = this.getUnitWorldPoint(targetId);
      if (!from || !to) return;

      if (this.isRangedUnit(attacker)) {
        this.spawnProjectile(from, to, kind === "crit");
      } else {
        this.spawnSlash(from, to, kind === "crit");
      }
    }

    private spawnSlash(from: { x: number; y: number }, to: { x: number; y: number }, isCrit: boolean) {
      const maxActive = 4;
      if (this.activeSlashes.length >= maxActive) {
        const old = this.activeSlashes.shift();
        old?.destroy();
      }
      const gfx = this.add.graphics();
      const color = isCrit ? 0xfacc15 : 0x7dd3fc;
      gfx.lineStyle(4, color, 0.45);
      const midX = (from.x + to.x) / 2 + (Math.random() - 0.5) * 18;
      const midY = (from.y + to.y) / 2 + (Math.random() - 0.5) * 12;
      gfx.beginPath();
      gfx.moveTo(from.x, from.y);
      gfx.lineTo(midX, midY);
      gfx.lineTo(to.x, to.y);
      gfx.strokePath();
      gfx.setAlpha(0.9);
      gfx.setDepth(6);
      this.trajectoryLayer.add(gfx);
      this.activeSlashes.push(gfx);

      const duration = Math.max(110, Math.round((isCrit ? 150 : 130) / this.speed));
      this.tweens.add({
        targets: gfx,
        alpha: 0,
        rotation: (Math.random() - 0.5) * 0.5,
        duration,
        ease: "Quad.easeOut",
        onComplete: () => {
          gfx.destroy();
          this.activeSlashes = this.activeSlashes.filter((s) => s !== gfx);
        },
      });

      if (DEBUG_FX) {
        const dot = this.add.circle(to.x, to.y, 3, 0xff0000, 0.8);
        dot.setDepth(7);
        this.trajectoryLayer.add(dot);
        this.tweens.add({
          targets: dot,
          alpha: 0,
          duration,
          onComplete: () => dot.destroy(),
        });
      }
    }

    private spawnProjectile(from: { x: number; y: number }, to: { x: number; y: number }, isCrit: boolean) {
      const maxActive = 5;
      if (this.activeProjectiles.length >= maxActive) {
        const old = this.activeProjectiles.shift();
        old?.destroy();
      }
      const radius = isCrit ? 6 : 5;
      const orb = this.add.circle(from.x, from.y, radius, 0x7ce4ff, 0.9);
      orb.setStrokeStyle(2, isCrit ? 0xfacc15 : 0x22d3ee, 0.9);
      orb.setDepth(6);
      this.trajectoryLayer.add(orb);
      this.activeProjectiles.push(orb);

      const duration = Math.max(140, Math.round((isCrit ? 220 : 180) / this.speed));
      this.tweens.add({
        targets: orb,
        x: to.x,
        y: to.y,
        scale: isCrit ? 1.1 : 1,
        alpha: { from: 1, to: 0.4 },
        duration,
        ease: "Sine.easeOut",
        onComplete: () => {
          this.spawnImpactBurst(to, isCrit);
          orb.destroy();
          this.activeProjectiles = this.activeProjectiles.filter((p) => p !== orb);
        },
      });
    }

    private spawnImpactBurst(point: { x: number; y: number }, isCrit: boolean) {
      const burstCount = isCrit ? 4 : 3;
      for (let i = 0; i < burstCount; i += 1) {
        const r = isCrit ? 3 : 2;
        const dot = this.add.circle(point.x, point.y, r, isCrit ? 0xfef08a : 0x7ce4ff, 0.8);
        dot.setDepth(7);
        this.trajectoryLayer.add(dot);
        const dx = (Math.random() - 0.5) * 14;
        const dy = (Math.random() - 0.5) * 12;
        this.tweens.add({
          targets: dot,
          x: point.x + dx,
          y: point.y + dy,
          alpha: 0,
          scale: 0.4,
          duration: Math.max(120, Math.round(180 / this.speed)),
          ease: "Quad.easeOut",
          onComplete: () => dot.destroy(),
        });
      }
    }

    private playCenterDeathPulse() {
      if (!this.centerPulse) return;
      const overlay = this.centerPulse;
      overlay.setAlpha(0.18);
      this.tweens.add({
        targets: overlay,
        alpha: 0.08,
        duration: Math.max(80, Math.round(120 / this.speed)),
        ease: "Quad.easeOut",
      });
    }

    private computeLanePressureOffset(params: {
      side: "ally" | "enemy";
      slotIndex: number;
      alive: boolean;
      hp01: number;
      teamAlive: number;
      oppAlive: number;
      t: number;
      speed: 1 | 2;
    }) {
      if (!params.alive) return { x: 0, y: 0 };
      const sign = params.side === "ally" ? 1 : -1;
      const baseEngage = 10 * sign;
      const isMelee = params.slotIndex <= 2;
      const roleOffset = (isMelee ? 8 : -6) * sign;
      const pressure = Math.min(4, Math.max(-4, params.teamAlive - params.oppAlive));
      const winningPush = pressure * 2 * sign;
      const phase = params.slotIndex * 0.7 + (params.side === "ally" ? 0 : 0.35);
      const breatheX = Math.sin(params.t * 0.9 + phase) * 1.5 * sign;
      const breatheY = Math.cos(params.t * 0.8 + phase) * 1.0;
      let x = baseEngage + roleOffset + winningPush + breatheX;
      let y = breatheY;
      const hpFalloff = 0.5 + params.hp01 * 0.5;
      x *= hpFalloff;
      y *= hpFalloff;
      const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
      return {
        x: clamp(x, -24, 24),
        y: clamp(y, -10, 10),
      };
    }

    private updatePressure(timeSeconds: number) {
      let allyAlive = 0;
      let enemyAlive = 0;
      this.units.forEach((u) => {
        if (u.spec.hp > 0) {
          if (u.spec.team === "ally") allyAlive += 1;
          else enemyAlive += 1;
        }
      });

      this.units.forEach((unit) => {
        const alive = unit.spec.hp > 0;
        const hp01 = unit.spec.maxHp > 0 ? Math.max(0, Math.min(1, unit.spec.hp / unit.spec.maxHp)) : 1;
        const teamAlive = unit.spec.team === "ally" ? allyAlive : enemyAlive;
        const oppAlive = unit.spec.team === "ally" ? enemyAlive : allyAlive;
        const offset = this.computeLanePressureOffset({
          side: unit.spec.team,
          slotIndex: unit.spec.slotIndex,
          alive,
          hp01,
          teamAlive,
          oppAlive,
          t: timeSeconds,
          speed: this.speed,
        });
        unit.pressureOffset.x = offset.x;
        unit.pressureOffset.y = offset.y;
      });

      if (DEBUG_LANE_PRESSURE) {
        this.pressureMarkers.forEach((m) => m.destroy());
        this.pressureMarkers = [];
        this.units.forEach((unit) => {
          const pos = this.getUnitWorldPoint(unit.spec.id);
          if (!pos) return;
          const g = this.add.graphics();
          g.lineStyle(1, unit.spec.team === "ally" ? 0x22d3ee : 0xf97316, 0.8);
          g.strokeCircle(pos.x, pos.y, 4);
          g.moveTo(pos.x - 4, pos.y);
          g.lineTo(pos.x + 4, pos.y);
          g.moveTo(pos.x, pos.y - 4);
          g.lineTo(pos.x, pos.y + 4);
          g.strokePath();
          g.setDepth(9);
          this.fxRoot.add(g);
          this.pressureMarkers.push(g);
        });
      }
    }
  };
}
