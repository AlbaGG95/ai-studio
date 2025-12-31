"use client";

import { useEffect, useRef } from "react";
import * as Phaser from "phaser";
import { EngineCombatState, UnitRuntimeState } from "@ai-studio/core";
import styles from "./play.module.css";
import { HeroArtSpec, buildHeroArtSpec } from "./heroArt";

type CombatLogEntry = {
  tick: number;
  actor: string;
  action: "attack" | "ultimate" | "defeat";
  target?: string;
  value?: number;
};

type UnitVisual = {
  container: Phaser.GameObjects.Container;
  body: Phaser.GameObjects.Graphics;
  armor: Phaser.GameObjects.Graphics;
  weapon: Phaser.GameObjects.Graphics;
  token: Phaser.GameObjects.Graphics;
  ring: Phaser.GameObjects.Graphics;
  role: Phaser.GameObjects.Graphics;
  aura: Phaser.GameObjects.Graphics;
  auraFx?: Phaser.GameObjects.Graphics;
  shadow: Phaser.GameObjects.Ellipse;
  hpBar: Phaser.GameObjects.Graphics;
  energyBar: Phaser.GameObjects.Graphics;
  label: Phaser.GameObjects.Text;
  fullLabel: Phaser.GameObjects.Text;
  side?: "player" | "enemy";
  isDead?: boolean;
  idleTween?: Phaser.Tweens.Tween;
  auraTween?: Phaser.Tweens.Tween;
  ringTween?: Phaser.Tweens.Tween;
  barState: { hp: number; energy: number };
  spec: HeroArtSpec;
};

const RARITY_COLORS = [0x6b7280, 0x38bdf8, 0xa855f7, 0xf59e0b];
const FACTION_COLORS = [0x7ce4ff, 0xf97316, 0x22c55e, 0xf472b6, 0xa78bfa];
const TARGET_ASPECT = 16 / 9;
const MIN_CANVAS_WIDTH = 320;
const MIN_CANVAS_HEIGHT = 360;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

const hashString = (input: string) => {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
  }
  return h >>> 0;
};

const seeded = (id: string, salt: string, min = 0, max = 1) => {
  const h = hashString(`${id}|${salt}`);
  const n = (h % 1000) / 1000;
  return min + n * (max - min);
};

const shortLabel = (name: string) => {
  const parts = name.split(/\s+/).filter(Boolean);
  if (!parts.length) return name.slice(0, 6);
  if (parts.length === 1) return parts[0].slice(0, 8);
  return `${parts[0].slice(0, 5)} ${parts[1].slice(0, 3)}`;
};

const hpColor = (pct: number) => {
  if (pct > 0.6) return 0x22c55e;
  if (pct > 0.3) return 0xfbbf24;
  return 0xf87171;
};

const computeCanvasSize = (bounds: DOMRectReadOnly) => {
  const baseWidth = Math.max(MIN_CANVAS_WIDTH, Math.floor(bounds.width || MIN_CANVAS_WIDTH));
  const maxHeight = Math.max(MIN_CANVAS_HEIGHT, Math.floor(bounds.height || baseWidth / TARGET_ASPECT));
  let width = baseWidth;
  let height = Math.round(width / TARGET_ASPECT);
  if (height > maxHeight) {
    height = maxHeight;
    width = Math.round(height * TARGET_ASPECT);
  }
  return { width, height };
};

class BattleScene extends Phaser.Scene {
  private units: Record<string, UnitVisual> = {};
  private tickMs: number;
  private lastCombat?: EngineCombatState;
  private ready = false;
  private hud?: {
    ally: Phaser.GameObjects.Text;
    enemy: Phaser.GameObjects.Text;
    last: Phaser.GameObjects.Text;
    speed: Phaser.GameObjects.Text;
    vignette: Phaser.GameObjects.Graphics;
  };
  private laneGuides?: Phaser.GameObjects.Graphics;
  private midLine?: Phaser.GameObjects.Rectangle;
  private fieldFrame?: Phaser.GameObjects.Graphics;
  private floorPlane?: Phaser.GameObjects.Graphics;
  private vignette?: Phaser.GameObjects.Graphics;
  private arenaFocus?: Phaser.GameObjects.Graphics;
  private damageNumbers = { player: [] as Phaser.GameObjects.Text[], enemy: [] as Phaser.GameObjects.Text[] };
  private pendingLogTimers: ReturnType<typeof setTimeout>[] = [];
  private hitStopActive = false;
  private heroArt: Record<string, HeroArtSpec> = {};
  private projectId?: string;
  private projectSeed = "offline";
  private banner?: Phaser.GameObjects.Text;

  constructor(tickMs: number) {
    super("BattleScene");
    this.tickMs = tickMs;
  }

  preload() {
    this.cameras.main.setBackgroundColor("#050814");
  }

  setHeroArt(map?: Record<string, HeroArtSpec>, projectId?: string, seed?: number | string) {
    this.heroArt = map || {};
    this.projectId = projectId;
    this.projectSeed = seed ? seed.toString() : projectId || "offline";
  }

  create() {
    this.ready = true;
    this.cameras.main?.setRoundPixels(true);
    this.drawBackground();
    this.drawLaneGuides();
    this.createHud();
    this.createBanner();
  }

  private layout() {
    const w = this.scale?.width ?? 960;
    const h = this.scale?.height ?? 540;
    const margin = Math.min(140, w * 0.08);
    const fieldWidth = w - margin * 2;
    const frontY = h * 0.44;
    const backY = h * 0.66;
    const frontSpacing = Math.max(72, fieldWidth * 0.12);
    const backSpacing = Math.max(68, fieldWidth * 0.1);
    return { w, h, margin, fieldWidth, frontY, backY, frontSpacing, backSpacing };
  }

  private drawBackground() {
    this.midLine?.destroy();
    this.fieldFrame?.destroy();
    this.floorPlane?.destroy();
    this.vignette?.destroy();
    this.arenaFocus?.destroy();
    this.focusFloor?.destroy?.();
    const { w, h } = this.layout();
    this.midLine = this.add.rectangle(w / 2, h / 2, 6, h * 0.82, 0x1b2438, 0.28).setDepth(2);
    this.midLine.setStrokeStyle(1, 0x25314b, 0.5);
    this.fieldFrame = this.add.graphics().setDepth(1);
    this.fieldFrame.clear();
    this.fieldFrame.fillStyle(0x0b0f1a, 0.42);
    this.fieldFrame.fillRoundedRect(12, 12, w - 24, h - 24, 18);
    this.fieldFrame.lineStyle(2, 0x233149, 0.4);
    this.fieldFrame.strokeRoundedRect(12, 12, w - 24, h - 24, 18);
    this.fieldFrame.fillStyle(0x12203b, 0.25);
    this.fieldFrame.fillEllipse(w / 2, h * 0.55, w * 0.72, h * 0.3);
    this.fieldFrame.fillStyle(0x143452, 0.08);
    this.fieldFrame.fillRect(12, h * 0.5, w * 0.45, h * 0.4);
    this.fieldFrame.fillStyle(0x3a0f16, 0.08);
    this.fieldFrame.fillRect(w * 0.55, h * 0.5, w * 0.43, h * 0.4);
    const floor = this.add.graphics().setDepth(1);
    floor.fillGradientStyle(0x0f172a, 0x111827, 0x0b1220, 0x0a1020, 0.6, 0.5, 0.45, 0.45);
    floor.fillEllipse(w / 2, h * 0.78, w * 0.74, h * 0.2);
    floor.lineStyle(1, 0x233149, 0.28);
    const segments = 6;
    for (let i = 1; i < segments; i++) {
      const y = h * 0.45 + (h * 0.3 * i) / segments;
      floor.lineBetween(w * 0.22, y, w * 0.78, y + i);
    }
    this.fieldFrame.lineStyle(1, 0x0a0e1c, 0.6);
    this.fieldFrame.strokeEllipse(w / 2, h * 0.55, w * 0.72, h * 0.3);
    const sideFloor = this.add.graphics().setDepth(2);
    sideFloor.fillStyle(0x0f1a2d, 0.32);
    sideFloor.fillEllipse(w * 0.28, h * 0.7, w * 0.26, h * 0.16);
    sideFloor.fillStyle(0x26121d, 0.28);
    sideFloor.fillEllipse(w * 0.72, h * 0.7, w * 0.26, h * 0.16);
    sideFloor.lineStyle(1, 0x1b2438, 0.4);
    sideFloor.strokeEllipse(w * 0.28, h * 0.7, w * 0.26, h * 0.16);
    sideFloor.strokeEllipse(w * 0.72, h * 0.7, w * 0.26, h * 0.16);
    const depthLines = this.add.graphics().setDepth(2);
    depthLines.lineStyle(1, 0x1e2b44, 0.3);
    const cols = [0.32, 0.46, 0.54, 0.68];
    cols.forEach((cx) => depthLines.lineBetween(w * cx, h * 0.35, w * cx, h * 0.85));
    depthLines.strokePath();
    const tint = this.add.graphics().setDepth(0);
    tint.fillStyle(0x123457, 0.12);
    tint.fillRect(0, 0, w * 0.22, h);
    tint.fillStyle(0x401624, 0.1);
    tint.fillRect(w * 0.78, 0, w * 0.22, h);
    const vignette = this.add.graphics().setDepth(200);
    vignette.clear();
    vignette.fillStyle(0x000000, 0.45);
    vignette.fillRect(0, 0, w, h);
    vignette.setBlendMode(Phaser.BlendModes.MULTIPLY);
    vignette.setAlpha(0.42);
    this.vignette = vignette;
    const focus = this.add.graphics().setDepth(5);
    focus.clear();
    focus.fillStyle(0x10233d, 0.2);
    focus.fillEllipse(w / 2, h * 0.52, w * 0.3, h * 0.2);
    focus.fillStyle(0x0d1222, 0.35);
    focus.fillEllipse(w / 2, h * 0.55, w * 0.42, h * 0.32);
    focus.setBlendMode(Phaser.BlendModes.ADD);
    this.arenaFocus = focus;
    this.floorPlane = floor;
  }

  private drawLaneGuides() {
    if (this.laneGuides) this.laneGuides.destroy();
    const { w, frontY, backY, margin } = this.layout();
    const guide = this.add.graphics().setDepth(3);
    guide.lineStyle(1, 0x233149, 0.45);
    guide.moveTo(margin, frontY);
    guide.lineTo(w - margin, frontY);
    guide.moveTo(margin, backY);
    guide.lineTo(w - margin, backY);
    const lanes = [0.26, 0.36, 0.46, 0.54, 0.64, 0.74];
    lanes.forEach((lx) => {
      guide.lineBetween(w * lx, frontY - 56, w * lx, backY + 56);
    });
    guide.strokePath();
    this.laneGuides = guide;
  }

  private createHud() {
    const w = this.scale.width;
    const h = this.scale.height;
    const ally = this.add
      .text(16, 10, "Aliados 0", { fontFamily: "sans-serif", fontSize: "13px", color: "#cbd5f5" })
      .setDepth(20);
    const enemy = this.add
      .text(w - 16, 10, "Enemigos 0", { fontFamily: "sans-serif", fontSize: "13px", color: "#cbd5f5" })
      .setOrigin(1, 0)
      .setDepth(20);
    const last = this.add
      .text(w / 2, h - 12, "Esperando acciones...", {
        fontFamily: "sans-serif",
        fontSize: "13px",
        color: "#9ca3af",
      })
      .setOrigin(0.5, 1)
      .setDepth(20);
    const speed = this.add
      .text(w / 2, 12, "1x", { fontFamily: "sans-serif", fontSize: "12px", color: "#7ce4ff" })
      .setOrigin(0.5, 0)
      .setDepth(20);
    ally.setShadow(0, 2, "#050814", 3);
    enemy.setShadow(0, 2, "#050814", 3);
    last.setShadow(0, 2, "#000000", 4);
    speed.setShadow(0, 2, "#000000", 3);
    const vignette = this.add.graphics({ x: 0, y: 0 }).setScrollFactor(0).setDepth(50).setAlpha(0);
    vignette.fillStyle(0x000000, 0.35);
    vignette.fillRect(0, 0, w, h);
    this.hud = { ally, enemy, last, speed, vignette };
  }

  private createBanner() {
    const { w, h } = this.layout();
    this.banner?.destroy();
    this.banner = this.add
      .text(w / 2, h * 0.18, "", {
        fontFamily: "sans-serif",
        fontSize: "28px",
        color: "#ffffff",
        fontStyle: "bold",
        stroke: "#0b0f1a",
        strokeThickness: 6,
      })
      .setDepth(120)
      .setOrigin(0.5)
      .setAlpha(0);
  }

  private unitPosition(unit: UnitRuntimeState, index: number) {
    const { w, frontY, backY, frontSpacing, backSpacing, margin, fieldWidth } = this.layout();
    const isFront = unit.position === "front";
    const sideBase = unit.side === "player" ? margin + fieldWidth * 0.26 : w - margin - fieldWidth * 0.26;
    const offsets = isFront ? [-frontSpacing / 2, frontSpacing / 2] : [-backSpacing, 0, backSpacing];
    const offset = offsets[Math.min(index, offsets.length - 1)] ?? 0;
    const x = sideBase + offset * (unit.side === "player" ? 1 : -1);
    const y = isFront ? frontY : backY;
    return { x, y };
  }

  private tokenPalette(unit: UnitRuntimeState) {
    const rarityIdx = Math.floor(seeded(unit.id, "rarity", 0, RARITY_COLORS.length - 1.0001));
    const factionIdx = Math.floor(seeded(unit.id, "faction", 0, FACTION_COLORS.length - 1.0001));
    const base = unit.side === "player" ? 0x7ce4ff : 0xfca5a5;
    return {
      border: RARITY_COLORS[rarityIdx],
      primary: base,
      inner: Phaser.Display.Color.Interpolate.ColorWithColor(
        Phaser.Display.Color.ValueToColor(base),
        Phaser.Display.Color.ValueToColor(0xffffff),
        100,
        35
      ).color,
      faction: FACTION_COLORS[factionIdx],
    };
  }

  private specForUnit(unit: UnitRuntimeState): HeroArtSpec {
    const existing = this.heroArt[unit.id];
    if (existing) return existing;
    const fallbackRarity = (unit as any).rarity || "common";
    const faction = (unit as any).faction || "default";
    return buildHeroArtSpec(
      {
        id: unit.id,
        role: (unit as any).role || "dps",
        faction,
        rarity: fallbackRarity,
      } as any,
      this.projectId || this.projectSeed
    );
  }

  private ensureUnit(unit: UnitRuntimeState, index: number) {
    const spec = this.specForUnit(unit);
    if (this.units[unit.id]) {
      const existing = this.units[unit.id];
      existing.spec = spec;
      this.drawVisualLayers(existing, unit);
      return existing;
    }
    const pos = this.unitPosition(unit, index);
    const container = this.add.container(pos.x, pos.y).setDepth(10 + (unit.side === "player" ? 0 : 1));
    const shadow = this.add.ellipse(0, 18, 96, 30, 0x000000, 0.28).setScale(1, 0.62);
    const aura = this.add.graphics();
    const auraFx = this.add.graphics();
    const ring = this.add.graphics();
    const body = this.add.graphics();
    const armor = this.add.graphics();
    const weapon = this.add.graphics();
    const token = this.add.graphics();
    const role = this.add.graphics();
    const hpBar = this.add.graphics();
    const energyBar = this.add.graphics();
    const label = this.add.text(0, 50, shortLabel(unit.name), {
      fontFamily: "sans-serif",
      fontSize: "12px",
      color: "#e5ecff",
      fontStyle: "bold",
    });
    label.setOrigin(0.5, 0);
    const fullLabel = this.add
      .text(0, 68, unit.name, { fontFamily: "sans-serif", fontSize: "11px", color: "#cbd5f5" })
      .setOrigin(0.5, 0)
      .setAlpha(0);
    const textResolution =
      typeof (this.game?.config as any)?.resolution === "number"
        ? Math.min(2, (this.game?.config as any).resolution)
        : 1;
    label.setResolution(textResolution);
    fullLabel.setResolution(textResolution);
    label.setShadow(0, 2, "#0b0f1a", 3);
    fullLabel.setShadow(0, 2, "#0b0f1a", 3);

    const hpPct = unit.maxHp > 0 ? clamp01(unit.hp / unit.maxHp) : 0;
    const energyPct = clamp01(unit.energy / 100);
    const barState = { hp: hpPct, energy: energyPct };
    container.add([
      shadow,
      aura,
      auraFx,
      ring,
      body,
      armor,
      weapon,
      token,
      role,
      hpBar,
      energyBar,
      label,
      fullLabel,
    ]);
    shadow.setDepth(-4);
    aura.setDepth(-3);
    ring.setDepth(-2);
    body.setDepth(-1);
    armor.setDepth(0);
    weapon.setDepth(1);
    token.setDepth(2);
    role.setDepth(3);
    hpBar.setDepth(6);
    energyBar.setDepth(7);
    label.setDepth(8);
    fullLabel.setDepth(9);
    container.setSize(96, 96);
    container.setInteractive(new Phaser.Geom.Circle(0, 0, 40), Phaser.Geom.Circle.Contains);
    container.on("pointerover", () => fullLabel.setAlpha(0.95));
    container.on("pointerout", () => fullLabel.setAlpha(0));

    const vis: UnitVisual = {
      container,
      token,
      ring,
      role,
      aura,
      shadow,
      hpBar,
      energyBar,
      label,
      fullLabel,
      side: unit.side,
      barState,
      body,
      armor,
      weapon,
      auraFx,
    };

    vis.idleTween = this.tweens.add({
      targets: container,
      y: container.y - 6,
      duration: 1400 + seeded(unit.id, "bob", 0, 220),
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
    vis.auraTween = this.tweens.add({
      targets: aura,
      alpha: { from: 0.55, to: 0.8 },
      scale: { from: 0.95, to: 1.05 },
      duration: 2400 + seeded(unit.id, "aura", 0, 520),
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    vis.spec = spec;
    this.units[unit.id] = vis;
    this.drawVisualLayers(vis, unit);
    return vis;
  }

  private resetVisualState(vis: UnitVisual) {
    vis.container.setAlpha(1);
    vis.container.setScale(1);
    vis.container.setVisible(true);
    vis.isDead = false;
    [vis.body, vis.armor, vis.weapon, vis.token, vis.ring, vis.aura, vis.role].forEach((g) => {
      if (g && typeof (g as any).clearTint === "function") {
        (g as any).clearTint();
      } else if (g && typeof (g as any).setTint === "function") {
        (g as any).setTint(0xffffff);
      }
      if (g && typeof (g as any).setAlpha === "function") {
        (g as any).setAlpha(1);
      }
    });
    vis.label.setAlpha(1);
    vis.fullLabel.setAlpha(0);
    if (vis.idleTween && !vis.idleTween.isPlaying()) vis.idleTween.restart();
    if (vis.auraTween && !vis.auraTween.isPlaying()) vis.auraTween.restart();
    if (vis.ringTween && !vis.ringTween.isPlaying()) vis.ringTween.restart();
  }

  private markDead(vis: UnitVisual) {
    if (vis.isDead) return;
    vis.isDead = true;
    this.tweens.killTweensOf([
      vis.container,
      vis.ring,
      vis.token,
      vis.body,
      vis.armor,
      vis.weapon,
      vis.aura,
      vis.label,
    ]);
    vis.idleTween?.stop();
    vis.auraTween?.stop();
    [vis.body, vis.armor, vis.weapon, vis.token, vis.ring, vis.aura, vis.role].forEach((g) => {
      if (g && typeof (g as any).setTint === "function") {
        (g as any).setTint(0x7a7a7a);
      }
      if (g && typeof (g as any).setAlpha === "function") {
        (g as any).setAlpha(0.6);
      }
    });
    vis.aura.setAlpha(0.35);
    vis.token.setAlpha(0.6);
    vis.label.setAlpha(0.4);
    this.time.delayedCall(150, () => {
      this.tweens.add({
        targets: vis.container,
        alpha: 0,
        scale: 0.86,
        duration: 320,
        ease: "Quad.easeIn",
        onComplete: () => vis.container.setVisible(false),
      });
    });
  }

  private drawVisualLayers(vis: UnitVisual, unit: UnitRuntimeState) {
    const spec = vis.spec;
    const palette = spec.palette;
    const aura = vis.aura;
    const ring = vis.ring;
    const body = vis.body;
    const armor = vis.armor;
    const weapon = vis.weapon;
    const token = vis.token;
    const role = vis.role;

    aura.clear();
    vis.auraFx?.clear();
    const baseRadius = 46 + spec.rarityRank * 2;
    if (spec.auraStyle === "halo") {
      aura.fillStyle(palette.aura, 0.22 + spec.rarityRank * 0.04);
      aura.fillEllipse(0, 6, baseRadius * 1.4, baseRadius * 0.5);
    } else {
      aura.lineStyle(3 + spec.rarityRank, palette.aura, 0.6);
      aura.strokeCircle(0, 0, baseRadius);
      if (spec.auraStyle === "sparks") {
        const sparkCount = 4 + spec.rarityRank * 2;
        for (let i = 0; i < sparkCount; i++) {
          const angle = seeded(spec.id, `spark-${i}`, 0, Math.PI * 2);
          const dist = baseRadius + seeded(spec.id, `spark-dist-${i}`, 6, 14);
          aura.fillStyle(palette.aura, 0.6);
          aura.fillCircle(Math.cos(angle) * dist, Math.sin(angle) * dist, 3 + spec.rarityRank);
        }
      }
    }

    ring.clear();
    ring.lineStyle(6, palette.border, 0.95);
    ring.strokeCircle(0, 0, 38);
    ring.lineStyle(2, palette.accent, 0.8);
    ring.strokeCircle(0, 0, 34);
    if (spec.rarityRank >= 2) {
      this.tweens.killTweensOf(ring);
      vis.ringTween = this.tweens.add({
        targets: ring,
        alpha: { from: 0.9, to: 0.5 },
        duration: 1200 + spec.rarityRank * 200,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
    }

    const torsoW = spec.silhouette === "bulky" ? 82 : spec.silhouette === "slim" ? 64 : 72;
    const torsoH = spec.silhouette === "robed" ? 94 : 82;
    const torsoY = -10;
    body.clear();
    body.fillStyle(palette.primary, 0.95);
    body.fillRoundedRect(-torsoW / 2, torsoY, torsoW, torsoH, 18);
    body.fillStyle(palette.secondary, 0.9);
    body.fillRoundedRect(-torsoW / 2 + 6, torsoY + 8, torsoW - 12, torsoH - 16, 14);
    body.fillCircle(0, torsoY - 26, spec.silhouette === "bulky" ? 26 : 24);

    armor.clear();
    const armorOpacity = spec.armor === "heavy" ? 0.55 : spec.armor === "mystic" ? 0.38 : 0.32;
    armor.fillStyle(palette.accent, armorOpacity);
    armor.fillRoundedRect(-torsoW / 2 + 10, torsoY + 10, torsoW - 20, torsoH - 32, 14);
    armor.lineStyle(2, palette.border, 0.8);
    armor.strokeRoundedRect(-torsoW / 2 + 10, torsoY + 10, torsoW - 20, torsoH - 32, 14);

    weapon.clear();
    this.drawWeaponGlyph(weapon, spec);

    token.clear();
    token.fillStyle(0xffffff, 0.12);
    token.fillEllipse(0, torsoY - 32, 28, 18);
    token.fillStyle(0x000000, 0.12);
    token.fillCircle(16, torsoY - 8, 12);

    role.clear();
    role.fillStyle(0x0b0f1a, 0.82);
    role.fillRoundedRect(-13, -13, 26, 26, 12);
    this.drawRoleGlyph(role, unit);
  }

  private resolveLabelCollisions() {
    const groups: Record<string, Phaser.GameObjects.Text[]> = { player: [], enemy: [] };
    Object.values(this.units).forEach((u) => {
      const side = u.spec?.id && (u.container.x < (this.scale.width || 960) / 2 ? "player" : "enemy");
      if (side) groups[side].push(u.label);
    });
    const spacing = 4;
    Object.values(groups).forEach((labels) => {
      const sorted = labels.sort((a, b) => a.y - b.y);
      for (let i = 1; i < sorted.length; i++) {
        const prev = sorted[i - 1];
        const cur = sorted[i];
        if (cur.y < prev.y + prev.height + spacing) {
          cur.setY(prev.y + prev.height + spacing);
        }
      }
    });
  }

  private showBanner(text: string) {
    if (!this.banner) return;
    this.banner.setText(text);
    this.banner.setAlpha(0);
    this.tweens.killTweensOf(this.banner);
    this.tweens.add({
      targets: this.banner,
      alpha: 1,
      scale: 1.05,
      duration: 320,
      ease: "Quad.easeOut",
      yoyo: true,
    });
  }

  private drawRoleGlyph(graphics: Phaser.GameObjects.Graphics, unit: UnitRuntimeState) {
    graphics.lineStyle(2, 0xffffff, 0.9);
    const role = unit.role?.toLowerCase() || "dps";
    graphics.save();
    if (role.includes("tank")) {
      graphics.beginPath();
      graphics.moveTo(-6, -8);
      graphics.lineTo(6, -8);
      graphics.lineTo(10, 0);
      graphics.lineTo(0, 10);
      graphics.lineTo(-10, 0);
      graphics.closePath();
      graphics.fillStyle(0x93c5fd, 0.9);
      graphics.fillPath();
      graphics.strokePath();
    } else if (role.includes("support")) {
      graphics.lineStyle(3, 0x34d399, 0.9);
      graphics.beginPath();
      graphics.moveTo(-8, 0);
      graphics.lineTo(8, 0);
      graphics.moveTo(0, -8);
      graphics.lineTo(0, 8);
      graphics.strokePath();
    } else if (role.includes("mage")) {
      graphics.fillStyle(0xa78bfa, 0.9);
      graphics.fillCircle(0, 0, 6);
      graphics.lineStyle(2, 0xc084fc, 0.8);
      graphics.strokeCircle(0, 0, 10);
      graphics.lineStyle(1.5, 0xffffff, 0.6);
      graphics.beginPath();
      graphics.moveTo(-4, -2);
      graphics.lineTo(4, 2);
      graphics.strokePath();
    } else {
      graphics.lineStyle(2.5, 0xf97316, 0.9);
      graphics.beginPath();
      graphics.moveTo(-7, -6);
      graphics.lineTo(7, 6);
      graphics.moveTo(7, -6);
      graphics.lineTo(-7, 6);
      graphics.strokePath();
    }
    graphics.restore();
  }

  private drawWeaponGlyph(graphics: Phaser.GameObjects.Graphics, spec: HeroArtSpec) {
    const c1 = spec.palette.accent;
    const c2 = spec.palette.border;
    graphics.lineStyle(3, c2, 0.9);
    if (spec.weapon === "shield") {
      graphics.fillStyle(c1, 0.6);
      graphics.fillRoundedRect(-40, -10, 32, 44, 10);
      graphics.lineStyle(2, c2, 1);
      graphics.strokeRoundedRect(-40, -10, 32, 44, 10);
    } else if (spec.weapon === "staff") {
      graphics.lineStyle(3, c2, 0.9);
      graphics.beginPath();
      graphics.moveTo(28, -24);
      graphics.lineTo(32, 42);
      graphics.strokePath();
      graphics.fillStyle(c1, 0.9);
      graphics.fillCircle(30, -28, 10);
    } else if (spec.weapon === "bow") {
      graphics.lineStyle(4, c2, 0.9);
      graphics.beginPath();
      graphics.moveTo(32, -28);
      graphics.lineTo(52, 4);
      graphics.lineTo(32, 38);
      graphics.strokePath();
      graphics.lineStyle(2, c1, 0.9);
      graphics.beginPath();
      graphics.moveTo(32, -28);
      graphics.lineTo(32, 38);
      graphics.strokePath();
    } else if (spec.weapon === "hammer") {
      graphics.fillStyle(c2, 0.9);
      graphics.fillRoundedRect(22, -8, 16, 48, 4);
      graphics.fillStyle(c1, 0.9);
      graphics.fillRoundedRect(12, -24, 36, 18, 6);
    } else if (spec.weapon === "claws" || spec.weapon === "dagger") {
      graphics.fillStyle(c1, 0.9);
      graphics.fillTriangle(22, -18, 46, -8, 20, 6);
      graphics.fillTriangle(18, 6, 42, 16, 16, 28);
    } else {
      graphics.fillStyle(c2, 0.9);
      graphics.fillRoundedRect(22, -12, 12, 52, 4);
      graphics.fillStyle(c1, 0.9);
      graphics.fillTriangle(18, -20, 48, -8, 18, 0);
      graphics.fillRoundedRect(16, 6, 26, 10, 4);
    }
  }

  private drawBars(vis: UnitVisual, unit: UnitRuntimeState) {
    const width = 86;
    const hpHeight = 8;
    const energyHeight = 6;
    const hpPct = unit.maxHp > 0 ? unit.hp / unit.maxHp : 0;
    const energyPct = Math.min(1, unit.energy / 100);
    vis.barState.hp = clamp01(Phaser.Math.Linear(vis.barState.hp, hpPct, 0.18));
    vis.barState.energy = clamp01(Phaser.Math.Linear(vis.barState.energy, energyPct, 0.26));
    const x = -width / 2;
    const hpY = -58;
    const energyY = -44;
    const palette = vis.spec?.palette;

    vis.hpBar.clear();
    vis.hpBar.fillStyle(0x0f172a, 0.78).fillRoundedRect(x, hpY, Math.round(width), hpHeight, 4);
    vis.hpBar
      .fillStyle(palette?.accent ?? hpColor(vis.barState.hp), 0.95)
      .fillRoundedRect(x, hpY, Math.round(width * vis.barState.hp), hpHeight, 4);
    vis.hpBar.lineStyle(1, 0x233149, 0.8).strokeRoundedRect(x, hpY, Math.round(width), hpHeight, 4);

    vis.energyBar.clear();
    vis.energyBar.fillStyle(0x0b1224, 0.75).fillRoundedRect(x, energyY, Math.round(width), energyHeight, 4);
    vis.energyBar
      .fillStyle(palette?.secondary ?? 0x7c3aed, 0.95)
      .fillRoundedRect(x, energyY, Math.round(width * vis.barState.energy), energyHeight, 4);
    vis.energyBar.lineStyle(1, 0x1f2b46, 0.7).strokeRoundedRect(x, energyY, Math.round(width), energyHeight, 4);
  }

  private animateAttack(vis: UnitVisual, unit: UnitRuntimeState, actionType: "basic" | "skill" | "ultimate") {
    this.tweens.getTweensOf(vis.container).forEach((tween) => {
      if (tween !== vis.idleTween) tween.stop();
    });
    vis.idleTween?.pause();
    const strength =
      actionType === "ultimate" ? 1.6 : actionType === "skill" ? 1.15 : 0.9 + seeded(unit.id, "basic-str", 0, 0.1);
    const offset = (unit.side === "player" ? 1 : -1) * (8 + seeded(unit.id, "lunge", 0, 8)) * strength;
    const duration = actionType === "ultimate" ? this.tickMs * 1.8 : actionType === "skill" ? this.tickMs : this.tickMs / 1.4;
    const scaleTarget = actionType === "ultimate" ? 1.12 : actionType === "skill" ? 1.06 : 1.02;
    this.tweens.add({
      targets: vis.container,
      x: vis.container.x + offset,
      duration,
      yoyo: true,
      ease: actionType === "ultimate" ? "Quad.easeInOut" : "Quad.easeOut",
      onComplete: () => vis.idleTween?.resume(),
    });
    this.tweens.add({
      targets: vis.container,
      scale: scaleTarget,
      duration: duration / (actionType === "ultimate" ? 1.6 : 2),
      yoyo: true,
      ease: "Quad.easeOut",
      onComplete: () => vis.idleTween?.resume(),
    });
  }

  private hitFeedback(vis: UnitVisual, unit: UnitRuntimeState, tick = 0, actionType: "basic" | "skill" | "ultimate" = "basic") {
    if (vis.isDead || !unit.alive) return;
    this.tweens.getTweensOf(vis.container).forEach((tween) => {
      if (tween !== vis.idleTween) tween.stop();
    });
    this.tweens.getTweensOf(vis.ring).forEach((tween) => {
      if (tween !== vis.ringTween) tween.stop();
    });
    vis.idleTween?.pause();
    vis.ringTween?.pause();
    const originalScale = vis.container.scale;
    const shakeDir = seeded(unit.id, `shake-${tick}`, -1, 1) >= 0 ? 1 : -1;
    const baseMag = actionType === "ultimate" ? 4 : actionType === "skill" ? 3 : 2;
    const shakeMag = baseMag + seeded(unit.id, `shake-mag-${tick}`, 0, 2);
    this.tweens.add({
      targets: vis.container,
      x: vis.container.x + (unit.side === "player" ? -1 : 1) * shakeMag * shakeDir,
      y: vis.container.y + shakeMag * 0.6,
      scale: originalScale * 0.98,
      duration: this.tickMs * 0.45,
      yoyo: true,
      ease: "Sine.easeInOut",
      onComplete: () => vis.idleTween?.resume(),
    });
    vis.token.setAlpha(0.7);
    vis.ring.setAlpha(0.85);
    const flash = this.add.circle(vis.container.x, vis.container.y, 46, 0xffffff, 0.2).setDepth(65);
    flash.setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({
      targets: flash,
      scale: 1.25,
      alpha: 0,
      duration: this.tickMs * 0.6,
      ease: "Quad.easeOut",
      onComplete: () => flash.destroy(),
    });
    this.time.delayedCall(this.tickMs * 0.4, () => {
      vis.token.setAlpha(1);
      vis.ring.setAlpha(1);
      vis.ringTween?.resume();
      vis.idleTween?.resume();
    });
    this.spawnImpactParticles(
      vis.container.x,
      vis.container.y,
      unit.side === "player" ? 0x7ce4ff : 0xfca5a5,
      `${unit.id}-${tick}`
    );
  }

  private spawnImpactParticles(x: number, y: number, color: number, seedKey: string) {
    const count = Math.round(seeded(seedKey, "count", 2, 6));
    for (let i = 0; i < count; i++) {
      const particleId = `${seedKey}-${i}`;
      const p = this.add.circle(x, y, seeded(particleId, "size", 3, 5), color, 0.95).setDepth(60);
      const angle = Phaser.Math.DegToRad(seeded(particleId, "angle", -28, 28));
      const dist = seeded(particleId, "dist", 10, 22);
      const drift = seeded(particleId, "drift", -4, 4);
      this.tweens.add({
        targets: p,
        x: x + Math.cos(angle) * dist + drift,
        y: y + Math.sin(angle) * dist + drift * 0.5,
        alpha: 0,
        scale: 0.4,
        duration: this.tickMs * 0.7,
        ease: "Quad.easeOut",
        onComplete: () => p.destroy(),
      });
    }
  }

  private triggerHitStop(durationMs = 100) {
    if (this.hitStopActive) return;
    const clamped = Math.min(120, Math.max(60, durationMs));
    this.hitStopActive = true;
    const tweens = this.tweens.getAllTweens();
    tweens.forEach((t) => t.pause());
    this.time.delayedCall(clamped, () => {
      tweens.forEach((t) => t.resume());
      this.hitStopActive = false;
    });
  }

  private damageNumber(
    target: UnitVisual,
    value: number | undefined,
    actionType: "basic" | "skill" | "ultimate",
    tick = 0,
    unitId?: string
  ) {
    if (target.isDead) return;
    const dmg = value ?? 0;
    const isBig = actionType === "ultimate" || dmg > 220;
    const topClamp = 40;
    const yStart = Math.max(topClamp, Math.min(target.container.y - 60, (this.scale.height || 540) - 140));
    const floatSeed = unitId ?? `target-${tick}`;
    const posX = Math.round(target.container.x);
    const posY = Math.round(yStart);
    const color =
      actionType === "ultimate" ? "#fde047" : actionType === "skill" ? "#7dd3fc" : dmg > 0 ? "#fca5a5" : "#a5b4fc";
    const stroke = actionType === "ultimate" ? "#0a0a0a" : "#0b0f1a";
    const fontSize = actionType === "ultimate" ? "22px" : actionType === "skill" ? "17px" : "14px";
    const scaleBoost = this.hitStopActive ? 1.08 : 1;
    const sideKey = target.side === "enemy" ? "enemy" : "player";
    const pool = this.damageNumbers[sideKey];
    if (pool.length >= 2) {
      const old = pool.shift();
      old?.destroy();
    }
    const txt = this.add
      .text(posX, posY, `-${dmg}`, {
        fontSize,
        fontFamily: "sans-serif",
        color,
        stroke,
        strokeThickness: 5,
        fontStyle: "bold",
      })
      .setDepth(120);
    pool.push(txt);
    txt.setOrigin(0.5);
    txt.setScale((actionType === "ultimate" ? 0.82 : actionType === "skill" ? 0.7 : 0.6) * scaleBoost);
    txt.setAlpha(0);
    this.tweens.add({
      targets: txt,
      scale: isBig ? 1.25 : actionType === "skill" ? 1.1 : 1.02,
      alpha: 1,
      duration: 120,
      ease: "Back.Out",
    });
    this.tweens.add({
      targets: txt,
      y: txt.y - 20 - seeded(floatSeed, `float-${tick}`, 0, 12),
      alpha: 0,
      duration: this.tickMs * (actionType === "ultimate" ? 1.4 : 1.1),
      delay: actionType === "ultimate" ? 140 : 90,
      ease: "Quad.easeOut",
      onComplete: () => {
        txt.destroy();
        this.damageNumbers[sideKey] = this.damageNumbers[sideKey].filter((t) => t !== txt);
      },
    });
  }

  private ultimateFlash(caster: UnitVisual) {
    if (!this.hud) return;
    this.hud.vignette.setAlpha(0.55);
    this.tweens.add({
      targets: this.hud.vignette,
      alpha: 0,
      duration: 360,
      ease: "Quad.easeOut",
    });
    this.vignette?.setAlpha(0.55);
    if (this.vignette) {
      this.tweens.add({
        targets: this.vignette,
        alpha: 0.42,
        duration: 480,
        ease: "Quad.easeOut",
      });
    }
    Object.values(this.units)
      .filter((u) => u.container !== caster.container)
      .forEach((u) => {
        if (u.isDead) return;
        [u.body, u.armor, u.weapon, u.token, u.ring, u.aura, u.role].forEach((g) => {
          if (g && typeof (g as any).setTint === "function") (g as any).setTint(0x9aa2b1);
        });
        this.time.delayedCall(200, () => {
          [u.body, u.armor, u.weapon, u.token, u.ring, u.aura, u.role].forEach((g) => {
            if (g && typeof (g as any).clearTint === "function") (g as any).clearTint();
          });
        });
      });

    const wave = this.add
      .circle(caster.container.x, caster.container.y, 28, 0xffffff, 0.16)
      .setDepth(55)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({
      targets: wave,
      scale: 3,
      alpha: 0,
      duration: 420,
      ease: "Quad.easeOut",
      onComplete: () => wave.destroy(),
    });

    this.tweens.add({
      targets: caster.aura,
      scale: 1.18,
      alpha: 1,
      duration: 220,
      yoyo: true,
      ease: "Sine.easeOut",
    });
    this.tweens.add({
      targets: caster.container,
      scale: 1.08,
      duration: 180,
      yoyo: true,
      ease: "Sine.easeOut",
    });
  }

  private updateHud(combat: EngineCombatState, lastAction?: string) {
    if (!this.hud) return;
    const allyAlive = combat.playerTeam?.filter((u) => u.alive).length ?? 0;
    const enemyAlive = combat.enemyTeam?.filter((u) => u.alive).length ?? 0;
    this.hud.ally.setText(`Aliados ${allyAlive}`);
    this.hud.enemy.setText(`Enemigos ${enemyAlive}`);
    if (lastAction) {
      this.hud.last.setText(lastAction);
    }
  }

  resize(width: number, height: number) {
    if (!this.scale || !this.cameras?.main) return;
    this.scale.resize(width, height);
    this.cameras.main.setViewport(0, 0, width, height);
    this.drawBackground();
    this.drawLaneGuides();
    if (this.hud) {
      this.hud.ally.setPosition(16, 10);
      this.hud.enemy.setPosition(width - 16, 10);
      this.hud.last.setPosition(width / 2, height - 12);
      this.hud.speed.setPosition(width / 2, 12);
      this.hud.vignette.clear();
      this.hud.vignette.fillStyle(0x000000, 0.35);
      this.hud.vignette.fillRect(0, 0, width, height);
      this.hud.vignette.setAlpha(0);
    }
    if (this.lastCombat) {
      this.updateCombat(this.lastCombat, []);
    }
  }

  updateCombat(combat?: EngineCombatState, logs: CombatLogEntry[] = []) {
    if (!combat || !this.ready) return;
    this.pendingLogTimers.forEach((t) => clearTimeout(t));
    this.pendingLogTimers = [];
    this.lastCombat = combat;
    const playerTeam = combat.playerTeam || [];
    const enemyTeam = combat.enemyTeam || [];
    const currentIds = new Set<string>();
    const orderForSide = (units: UnitRuntimeState[]) => {
      const front = units.filter((u) => u.position === "front");
      const back = units.filter((u) => u.position !== "front");
      return { front, back };
    };
    const playerOrder = orderForSide(playerTeam);
    const enemyOrder = orderForSide(enemyTeam);

    [...playerTeam, ...enemyTeam].forEach((u) => {
      const isPlayer = u.side === "player";
      const sideOrder = isPlayer ? playerOrder : enemyOrder;
      const arr = u.position === "front" ? sideOrder.front : sideOrder.back;
      const idx = Math.max(0, arr.findIndex((x) => x.id === u.id));
      const vis = this.ensureUnit(u, idx);
      const pos = this.unitPosition(u, idx);
      vis.container.setPosition(Math.round(pos.x), Math.round(pos.y));
      vis.container.setDepth((u.side === "player" ? 10 : 20) + (u.position === "front" ? 2 : 0));
      vis.label.setText(shortLabel(u.name));
      this.drawBars(vis, u);
      if (!u.alive) {
        this.markDead(vis);
      } else {
        this.resetVisualState(vis);
      }
      currentIds.add(u.id);
    });

    let lastAction: string | undefined;
    const baseDelay = 110;
    logs.forEach((log, idx) => {
      const timer = setTimeout(() => {
        const tick = log.tick ?? 0;
        const actionType: "basic" | "skill" | "ultimate" =
          log.action === "ultimate" ? "ultimate" : log.value && log.value >= 120 ? "skill" : "basic";
        const actor = [...playerTeam, ...enemyTeam].find((u) => u.name === log.actor || u.id === log.actor);
      const target = [...playerTeam, ...enemyTeam].find((u) => u.name === log.target || u.id === log.target);
      const isKill = log.action === "defeat" || target?.alive === false;
      if (actor) {
        const vis = this.units[actor.id];
        if (vis && (log.action === "attack" || log.action === "ultimate")) {
            this.animateAttack(vis, actor, actionType);
            if (actionType === "ultimate") {
              this.ultimateFlash(vis);
            }
          }
        }
        if (target) {
          const vis = this.units[target.id];
          if (vis && target.alive && !vis.isDead) {
            this.hitFeedback(vis, target, tick, actionType);
            if (log.value !== undefined) {
              this.damageNumber(vis, log.value, actionType, tick, target.id);
            }
          }
        }
        if ((actionType === "ultimate" || isKill) && !this.hitStopActive) {
          this.triggerHitStop(actionType === "ultimate" ? 110 : 90);
        }
        if (actor) {
          const targetLabel = target ? shortLabel(target.name) : "";
          const verb = log.action === "ultimate" ? "ulti" : log.action;
          lastAction = `${shortLabel(actor.name)} ${verb}${targetLabel ? ` -> ${targetLabel}` : ""}`;
        }
      }, baseDelay + idx * 35);
      this.pendingLogTimers.push(timer);
    });

    this.updateHud(combat, lastAction);

    // remove visuals not present
    Object.keys(this.units).forEach((id) => {
      if (!currentIds.has(id)) {
        this.tweens.killTweensOf(this.units[id].container);
        this.tweens.killTweensOf(this.units[id].ring);
        this.tweens.killTweensOf(this.units[id].aura);
        this.tweens.killTweensOf(this.units[id].token);
        this.units[id].container.destroy(true);
        delete this.units[id];
      }
    });

    this.resolveLabelCollisions();
    if (!combat.inProgress) {
      const playerAlive = combat.playerTeam?.some((u) => u.alive);
      const enemyAlive = combat.enemyTeam?.some((u) => u.alive);
      this.showBanner(playerAlive && !enemyAlive ? "VICTORIA" : "DERROTA");
    } else {
      this.banner?.setAlpha(0);
    }
  }
}

type BattleCanvasProps = {
  combat?: EngineCombatState;
  logs: CombatLogEntry[];
  tickMs: number;
  heroArt?: Record<string, HeroArtSpec>;
  projectId?: string;
  seed?: number;
};

export function BattleCanvas({ combat, logs, tickMs, heroArt, projectId, seed }: BattleCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<BattleScene | null>(null);
  const gameRef = useRef<Phaser.Game | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    if (gameRef.current) {
      gameRef.current.destroy(true);
      gameRef.current = null;
      sceneRef.current = null;
    }
    const resolution = typeof window !== "undefined" ? Math.min(2, window.devicePixelRatio || 1) : 1;
    const scene = new BattleScene(tickMs);
    sceneRef.current = scene;
    const rect = containerRef.current.getBoundingClientRect();
    const { width, height } = computeCanvasSize(rect);
    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: containerRef.current,
      width,
      height,
      backgroundColor: "#0b0f1a",
      scene: scene,
      scale: {
        mode: Phaser.Scale.NONE,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
      render: { antialias: true, roundPixels: true, pixelArt: false },
      resolution,
    });
    gameRef.current = game;
    scene.setHeroArt(heroArt, projectId, seed);

    const handleResize = () => {
      if (!containerRef.current || !game.scale) return;
      const bounds = containerRef.current.getBoundingClientRect();
      const { width: w, height: h } = computeCanvasSize(bounds);
      game.scale.resize(w, h);
      sceneRef.current?.resize(w, h);
    };
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      game.destroy(true);
      sceneRef.current = null;
      gameRef.current = null;
    };
  }, [tickMs]);

  useEffect(() => {
    sceneRef.current?.setHeroArt(heroArt, projectId, seed);
    if (combat) {
      sceneRef.current?.updateCombat(combat, []);
    }
  }, [heroArt, projectId, seed]);

  useEffect(() => {
    if (!sceneRef.current) return;
    sceneRef.current.updateCombat(combat, logs);
  }, [combat, logs]);

  return <div ref={containerRef} className={styles.battleCanvas} />;
}
