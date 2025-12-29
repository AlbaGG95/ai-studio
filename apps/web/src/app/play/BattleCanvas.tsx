"use client";

import { useEffect, useRef } from "react";
import * as Phaser from "phaser";
import { EngineCombatState, UnitRuntimeState } from "@ai-studio/core";
import styles from "./play.module.css";

type CombatLogEntry = {
  tick: number;
  actor: string;
  action: "attack" | "ultimate" | "defeat";
  target?: string;
  value?: number;
};

type UnitVisual = {
  container: Phaser.GameObjects.Container;
  token: Phaser.GameObjects.Graphics;
  ring: Phaser.GameObjects.Graphics;
  role: Phaser.GameObjects.Graphics;
  aura: Phaser.GameObjects.Graphics;
  shadow: Phaser.GameObjects.Ellipse;
  hpBar: Phaser.GameObjects.Graphics;
  energyBar: Phaser.GameObjects.Graphics;
  label: Phaser.GameObjects.Text;
  fullLabel: Phaser.GameObjects.Text;
  barState: { hp: number; energy: number };
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

  constructor(tickMs: number) {
    super("BattleScene");
    this.tickMs = tickMs;
  }

  preload() {
    this.cameras.main.setBackgroundColor("#050814");
  }

  create() {
    this.ready = true;
    this.drawBackground();
    this.drawLaneGuides();
    this.createHud();
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
    const { w, h } = this.layout();
    this.midLine = this.add.rectangle(w / 2, h / 2, 6, h * 0.82, 0x1b2438, 0.35).setDepth(2);
    this.midLine.setStrokeStyle(1, 0x25314b, 0.6);
    this.fieldFrame = this.add.graphics().setDepth(1);
    this.fieldFrame.fillStyle(0x0b0f1a, 0.36);
    this.fieldFrame.fillRoundedRect(12, 12, w - 24, h - 24, 18);
    this.fieldFrame.lineStyle(2, 0x233149, 0.4);
    this.fieldFrame.strokeRoundedRect(12, 12, w - 24, h - 24, 18);
    this.fieldFrame.fillStyle(0x12203b, 0.25);
    this.fieldFrame.fillEllipse(w / 2, h * 0.55, w * 0.72, h * 0.3);
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

  private ensureUnit(unit: UnitRuntimeState, index: number) {
    if (this.units[unit.id]) return this.units[unit.id];
    const pos = this.unitPosition(unit, index);
    const palette = this.tokenPalette(unit);
    const container = this.add.container(pos.x, pos.y).setDepth(10 + (unit.side === "player" ? 0 : 1));
    const shadow = this.add.ellipse(0, 18, 96, 30, 0x000000, 0.28).setScale(1, 0.62);
    const aura = this.add.graphics();
    const ring = this.add.graphics();
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
    label.setShadow(0, 2, "#0b0f1a", 3);
    fullLabel.setShadow(0, 2, "#0b0f1a", 3);

    const drawToken = () => {
      const main = palette.primary;
      const inner = palette.inner;
      aura.clear();
      aura.fillStyle(palette.faction, 0.16);
      aura.fillCircle(0, 0, 48);
      aura.lineStyle(2, palette.faction, 0.35);
      aura.strokeCircle(0, 0, 52);
      ring.clear();
      ring.lineStyle(6, palette.border, 0.95);
      ring.strokeCircle(0, 0, 38);
      ring.lineStyle(2, palette.faction, 0.8);
      ring.strokeCircle(0, 0, 34);
      token.clear();
      token.fillStyle(main, 0.94);
      token.fillCircle(0, 0, 34);
      token.fillStyle(inner, 0.95);
      token.fillCircle(0, -3, 28);
      token.fillStyle(0xffffff, 0.12);
      token.fillEllipse(0, -18, 32, 20);
      token.fillStyle(0xffffff, 0.08);
      token.fillEllipse(-10, -6, 26, 12);
      token.fillStyle(0x000000, 0.12);
      token.fillCircle(12, 12, 16);
      role.clear();
      role.fillStyle(0x0b0f1a, 0.82);
      role.fillRoundedRect(-13, -13, 26, 26, 12);
      this.drawRoleGlyph(role, unit);
    };

    drawToken();

    const hpPct = unit.maxHp > 0 ? clamp01(unit.hp / unit.maxHp) : 0;
    const energyPct = clamp01(unit.energy / 100);
    const barState = { hp: hpPct, energy: energyPct };
    container.add([shadow, aura, ring, token, role, hpBar, energyBar, label, fullLabel]);
    container.setSize(96, 96);
    container.setInteractive(new Phaser.Geom.Circle(0, 0, 40), Phaser.Geom.Circle.Contains);
    container.on("pointerover", () => fullLabel.setAlpha(0.95));
    container.on("pointerout", () => fullLabel.setAlpha(0));

    this.tweens.add({
      targets: container,
      y: container.y - 6,
      duration: 1400 + seeded(unit.id, "bob", 0, 220),
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
    this.tweens.add({
      targets: aura,
      alpha: { from: 0.55, to: 0.8 },
      scale: { from: 0.95, to: 1.05 },
      duration: 2400 + seeded(unit.id, "aura", 0, 520),
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    this.units[unit.id] = { container, token, ring, role, aura, shadow, hpBar, energyBar, label, fullLabel, barState };
    return this.units[unit.id];
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

    vis.hpBar.clear();
    vis.hpBar.fillStyle(0x0f172a, 0.78).fillRoundedRect(x, hpY, width, hpHeight, 4);
    vis.hpBar.fillStyle(hpColor(vis.barState.hp), 0.95).fillRoundedRect(x, hpY, width * vis.barState.hp, hpHeight, 4);
    vis.hpBar.lineStyle(1, 0x233149, 0.8).strokeRoundedRect(x, hpY, width, hpHeight, 4);

    vis.energyBar.clear();
    vis.energyBar.fillStyle(0x0b1224, 0.75).fillRoundedRect(x, energyY, width, energyHeight, 4);
    vis.energyBar
      .fillStyle(0x7c3aed, 0.95)
      .fillRoundedRect(x, energyY, width * vis.barState.energy, energyHeight, 4);
    vis.energyBar.lineStyle(1, 0x1f2b46, 0.7).strokeRoundedRect(x, energyY, width, energyHeight, 4);
  }

  private animateAttack(vis: UnitVisual, unit: UnitRuntimeState) {
    const offset = (unit.side === "player" ? 1 : -1) * (8 + seeded(unit.id, "lunge", 0, 8));
    this.tweens.add({
      targets: vis.container,
      x: vis.container.x + offset,
      duration: this.tickMs / 1.4,
      yoyo: true,
      ease: "Quad.easeOut",
    });
    this.tweens.add({
      targets: vis.container,
      scale: 1.02,
      duration: this.tickMs / 2,
      yoyo: true,
      ease: "Quad.easeOut",
    });
  }

  private hitFeedback(vis: UnitVisual, unit: UnitRuntimeState, tick = 0) {
    const originalScale = vis.container.scale;
    const shakeDir = seeded(unit.id, `shake-${tick}`, -1, 1) >= 0 ? 1 : -1;
    const shakeMag = 2 + seeded(unit.id, `shake-mag-${tick}`, 0, 2);
    this.tweens.add({
      targets: vis.container,
      x: vis.container.x + (unit.side === "player" ? -1 : 1) * shakeMag * shakeDir,
      y: vis.container.y + shakeMag * 0.6,
      scale: originalScale * 0.98,
      duration: this.tickMs * 0.45,
      yoyo: true,
      ease: "Sine.easeInOut",
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
        duration: this.tickMs * 0.9,
        ease: "Quad.easeOut",
        onComplete: () => p.destroy(),
      });
    }
  }

  private damageNumber(
    target: UnitVisual,
    value?: number,
    action?: CombatLogEntry["action"],
    tick = 0,
    unitId?: string
  ) {
    const dmg = value ?? 0;
    const isBig = action === "ultimate" || dmg > 200;
    const yStart = Math.max(30, target.container.y - 60);
    const floatSeed = unitId ?? `target-${tick}`;
    const txt = this.add
      .text(target.container.x, yStart, `-${dmg}`, {
        fontSize: isBig ? "19px" : "15px",
        fontFamily: "sans-serif",
        color: isBig ? "#fde047" : "#fca5a5",
        stroke: "#0b0f1a",
        strokeThickness: 5,
        fontStyle: "bold",
      })
      .setDepth(80);
    txt.setOrigin(0.5);
    txt.setScale(0.6);
    txt.setAlpha(0);
    this.tweens.add({
      targets: txt,
      scale: isBig ? 1.25 : 1.05,
      alpha: 1,
      duration: 120,
      ease: "Back.Out",
    });
    this.tweens.add({
      targets: txt,
      y: txt.y - 20 - seeded(floatSeed, `float-${tick}`, 0, 12),
      alpha: 0,
      duration: this.tickMs * 1.6,
      delay: 90,
      ease: "Quad.easeOut",
      onComplete: () => txt.destroy(),
    });
  }

  private ultimateFlash(caster: UnitVisual) {
    if (!this.hud) return;
    this.hud.vignette.setAlpha(0.45);
    this.tweens.add({
      targets: this.hud.vignette,
      alpha: 0,
      duration: 260,
      ease: "Quad.easeOut",
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
    this.lastCombat = combat;
    const playerTeam = combat.playerTeam || [];
    const enemyTeam = combat.enemyTeam || [];
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
      vis.container.setPosition(pos.x, pos.y);
      vis.container.setDepth((u.side === "player" ? 10 : 20) + (u.position === "front" ? 2 : 0));
      vis.label.setText(shortLabel(u.name));
      this.drawBars(vis, u);
      const alpha = u.alive ? 1 : 0.28;
      vis.container.setAlpha(alpha);
      vis.label.setAlpha(u.alive ? 1 : 0.45);
      vis.fullLabel.setAlpha(0);
    });

    let lastAction: string | undefined;
    logs.forEach((log) => {
      const tick = log.tick ?? 0;
      const actor = [...playerTeam, ...enemyTeam].find((u) => u.name === log.actor || u.id === log.actor);
      const target = [...playerTeam, ...enemyTeam].find((u) => u.name === log.target || u.id === log.target);
      if (actor) {
        const vis = this.units[actor.id];
        if (vis && (log.action === "attack" || log.action === "ultimate")) {
          this.animateAttack(vis, actor);
          if (log.action === "ultimate") {
            this.ultimateFlash(vis);
          }
        }
      }
      if (target) {
        const vis = this.units[target.id];
        if (vis) {
          this.hitFeedback(vis, target, tick);
          if (log.value !== undefined) {
            this.damageNumber(vis, log.value, log.action, tick, target.id);
          }
        }
      }
      if (actor) {
        const targetLabel = target ? shortLabel(target.name) : "";
        const verb = log.action === "ultimate" ? "ulti" : log.action;
        lastAction = `${shortLabel(actor.name)} ${verb}${targetLabel ? ` -> ${targetLabel}` : ""}`;
      }
    });

    this.updateHud(combat, lastAction);
  }
}

type BattleCanvasProps = {
  combat?: EngineCombatState;
  logs: CombatLogEntry[];
  tickMs: number;
};

export function BattleCanvas({ combat, logs, tickMs }: BattleCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<BattleScene | null>(null);
  const gameRef = useRef<Phaser.Game | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
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
    });
    gameRef.current = game;

    const handleResize = () => {
      if (!containerRef.current || !game.scale) return;
      const bounds = containerRef.current.getBoundingClientRect();
      const { width: w, height: h } = computeCanvasSize(bounds);
      sceneRef.current?.resize(w, h);
    };
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      game.destroy(true);
      sceneRef.current = null;
    };
  }, [tickMs]);

  useEffect(() => {
    if (!sceneRef.current) return;
    sceneRef.current.updateCombat(combat, logs);
  }, [combat, logs]);

  return <div ref={containerRef} className={styles.battleCanvas} />;
}
