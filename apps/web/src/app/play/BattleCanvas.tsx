"use client";

import { useEffect, useRef } from "react";
import * as Phaser from "phaser";
import {
  EngineCombatState,
  UnitRuntimeState,
} from "@ai-studio/core";

type CombatLogEntry = {
  tick: number;
  actor: string;
  action: "attack" | "ultimate" | "defeat";
  target?: string;
  value?: number;
};

type UnitVisual = {
  sprite: Phaser.GameObjects.Ellipse;
  hpBar: Phaser.GameObjects.Graphics;
  energyBar: Phaser.GameObjects.Graphics;
  nameText: Phaser.GameObjects.Text;
};

class BattleScene extends Phaser.Scene {
  private units: Record<string, UnitVisual> = {};
  private tickMs: number;
  private lastCombat?: EngineCombatState;
  private ready = false;
  private baseColors: Record<string, number> = {};

  constructor(tickMs: number) {
    super("BattleScene");
    this.tickMs = tickMs;
  }

  preload() {
    this.cameras.main.setBackgroundColor("#0b0f1a");
  }

  create() {
    this.ready = true;
    const w = this.scale.width;
    const h = this.scale.height;
    const mid = this.add.rectangle(w / 2, h / 2, 6, h * 0.8, 0x1f2b46, 0.3);
    mid.setStrokeStyle(1, 0x2f3f63, 0.5);
    this.add.text(20, 16, "Batalla en curso", {
      fontFamily: "sans-serif",
      fontSize: "16px",
      color: "#cbd5f5",
    });
  }

  private unitPosition(unit: UnitRuntimeState, index: number) {
    const w = this.scale?.width ?? 960;
    const h = this.scale?.height ?? 540;
    const frontY = h * 0.42;
    const backY = h * 0.62;
    const baseY = unit.position === "front" ? frontY : backY;
    const spread = Math.max(70, Math.min(120, w * 0.08));
    const sideBase = unit.side === "player" ? w * 0.25 : w * 0.75;
    return { x: sideBase + (index - 1) * spread, y: baseY };
  }

  private ensureUnit(unit: UnitRuntimeState, index: number) {
    if (this.units[unit.id]) return this.units[unit.id];
    const pos = this.unitPosition(unit, index);
    const color = unit.side === "player" ? 0x7ce4ff : 0xfca5a5;
    const sprite = this.add.ellipse(pos.x, pos.y, 64, 64, color, 0.35);
    sprite.setStrokeStyle(3, color, 0.9);
    const hpBar = this.add.graphics();
    const energyBar = this.add.graphics();
    const nameText = this.add.text(pos.x, pos.y + 46, unit.name, {
      fontSize: "12px",
      fontFamily: "sans-serif",
      color: "#e5ecff",
    });
    nameText.setOrigin(0.5, 0);
    this.baseColors[unit.id] = color;
    this.units[unit.id] = { sprite, hpBar, energyBar, nameText };
    return this.units[unit.id];
  }

  private drawBars(vis: UnitVisual, unit: UnitRuntimeState) {
    const width = 80;
    const height = 8;
    const x = vis.sprite.x - width / 2;
    const y = vis.sprite.y - 50;
    const hpPct = unit.maxHp > 0 ? unit.hp / unit.maxHp : 0;
    vis.hpBar.clear();
    vis.hpBar.fillStyle(0x1f2937, 0.8).fillRoundedRect(x, y, width, height, 4);
    vis.hpBar.fillStyle(0x22c55e, 0.9).fillRoundedRect(x, y, width * hpPct, height, 4);

    const energyPct = Math.min(1, unit.energy / 100);
    vis.energyBar.clear();
    vis.energyBar.fillStyle(0x0f172a, 0.8).fillRoundedRect(x, y + 10, width, 6, 4);
    vis.energyBar.fillStyle(0x7ce4ff, 0.9).fillRoundedRect(x, y + 10, width * energyPct, 6, 4);
  }

  private damageNumber(target: UnitVisual, value?: number) {
    const dmg = value ?? 0;
    const txt = this.add.text(target.sprite.x, target.sprite.y - 40, `-${dmg}`, {
      fontSize: "14px",
      fontFamily: "sans-serif",
      color: "#f87171",
      stroke: "#0b0f1a",
      strokeThickness: 3,
      fontStyle: "bold",
    });
    txt.setOrigin(0.5);
    this.tweens.add({
      targets: txt,
      y: txt.y - 20,
      alpha: 0,
      duration: this.tickMs * 2,
      onComplete: () => txt.destroy(),
    });
  }

  private animateAttack(actor: UnitVisual, unit: UnitRuntimeState) {
    const offset = unit.side === "player" ? 22 : -22;
    this.tweens.add({
      targets: actor.sprite,
      x: actor.sprite.x + offset,
      yoyo: true,
      duration: this.tickMs / 1.2,
      ease: "Sine.easeInOut",
    });
  }

  private hitFlash(target: UnitVisual, unit: UnitRuntimeState) {
    const original = this.baseColors[unit.id] || (unit.side === "player" ? 0x7ce4ff : 0xfca5a5);
    target.sprite.setStrokeStyle(3, 0xffffff, 1);
    this.tweens.add({
      targets: target.sprite,
      alpha: { from: 1, to: 0.6 },
      x: target.sprite.x + (unit.side === "player" ? 4 : -4),
      yoyo: true,
      duration: this.tickMs / 1.5,
      ease: "Quad.easeOut",
      onComplete: () => target.sprite.setStrokeStyle(3, original, 0.9),
    });
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
      vis.sprite.setPosition(pos.x, pos.y);
      vis.nameText.setPosition(pos.x, pos.y + 46);
      vis.sprite.setVisible(u.alive);
      vis.nameText.setText(u.name);
      this.drawBars(vis, u);
      if (!u.alive) {
        vis.sprite.setAlpha(0.25);
        vis.nameText.setAlpha(0.4);
      } else {
        vis.sprite.setAlpha(1);
        vis.nameText.setAlpha(1);
      }
    });

    logs.forEach((log) => {
      const actor = [...playerTeam, ...enemyTeam].find((u) => u.name === log.actor || u.id === log.actor);
      const target = [...playerTeam, ...enemyTeam].find((u) => u.name === log.target || u.id === log.target);
      if (actor) {
        const vis = this.units[actor.id];
        if (vis) {
          this.animateAttack(vis, actor);
          if (log.action === "ultimate") {
            vis.sprite.setFillStyle(actor.side === "player" ? 0x7c3aed : 0xf97316, 0.7);
            this.time.delayedCall(this.tickMs * 1.5, () => {
              vis.sprite.setFillStyle(actor.side === "player" ? 0x7ce4ff : 0xfca5a5, 0.35);
            });
          }
        }
      }
      if (target) {
        const vis = this.units[target.id];
        if (vis && log.value !== undefined) {
          this.hitFlash(vis, target);
          this.tweens.add({
            targets: vis.sprite,
            x: vis.sprite.x + (target.side === "player" ? -6 : 6),
            yoyo: true,
            duration: this.tickMs / 2,
            ease: "Sine.easeInOut",
          });
          this.damageNumber(vis, log.value);
        }
      }
    });
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
    const width = rect.width || 960;
    const height = Math.round(width * (9 / 16));
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
      const w = bounds.width || 960;
      const h = Math.round(w * (9 / 16));
      game.scale.resize(w, h);
      const camera = sceneRef.current?.cameras?.main;
      camera?.setViewport(0, 0, w, h);
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

  return <div ref={containerRef} style={{ width: "100%", maxWidth: 960, margin: "0 auto" }} />;
}
