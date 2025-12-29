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
    const h = this.scale?.height ?? 540;
    const frontY = h * 0.45;
    const backY = h * 0.62;
    const baseY = unit.position === "front" ? frontY : backY;
    const spread = 80;

    if (unit.side === "player") {
      return { x: 180 + index * spread, y: baseY };
    }
    return { x: this.scale.width - 180 - index * spread, y: baseY };
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
      strokeThickness: 2,
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
    const offset = unit.side === "player" ? 18 : -18;
    this.tweens.add({
      targets: actor.sprite,
      x: actor.sprite.x + offset,
      yoyo: true,
      duration: this.tickMs / 1.2,
      ease: "Sine.easeInOut",
    });
  }

  updateCombat(combat?: EngineCombatState, logs: CombatLogEntry[] = []) {
    if (!combat || !this.ready) return;
    this.lastCombat = combat;
    const teams: UnitRuntimeState[] = [
      ...(combat.playerTeam || []),
      ...(combat.enemyTeam || []),
    ];

    teams.forEach((u, idx) => {
      const vis = this.ensureUnit(u, idx);
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
      const actor = teams.find((u) => u.name === log.actor || u.id === log.actor);
      const target = teams.find((u) => u.name === log.target || u.id === log.target);
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
    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: containerRef.current,
      width: 960,
      height: 540,
      backgroundColor: "#0b0f1a",
      scene: scene,
    });
    gameRef.current = game;
    return () => {
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
