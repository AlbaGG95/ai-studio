"use client";

import { useEffect, useRef } from "react";
import { AfkCombatEvent, AfkHeroVisual } from "@ai-studio/core";
import styles from "../afk.module.css";

export interface RenderUnit {
  id: string;
  name: string;
  team: "ally" | "enemy";
  slot: number;
  hp: number;
  maxHp: number;
  energy: number;
  visual: AfkHeroVisual;
}

type Props = {
  units: RenderUnit[];
  lastEvent: AfkCombatEvent | null;
  speed: number;
  height?: number;
};

type UnitSprites = {
  sprite: any;
  hpBar: any;
  energyBar: any;
  baseColor: number;
};

export function PhaserBattle({ units, lastEvent, speed, height = 500 }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<any>(null);
  const gameRef = useRef<any>(null);
  const speedRef = useRef<number>(speed);

  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  useEffect(() => {
    let mounted = true;
    async function boot() {
      const Phaser = (await import("phaser")).default;
      if (!mounted || gameRef.current || !containerRef.current) return;
      const width = containerRef.current.clientWidth || 380;

      class BattleScene extends Phaser.Scene {
        unitMap: Record<string, UnitSprites> = {};

        constructor() {
          super("afk-battle");
        }

        create() {
          this.cameras.main.setBackgroundColor("#0b1222");
          this.add.rectangle(width / 2, height - 30, width * 0.8, 50, 0x0c1a2f, 0.4);
          this.add.rectangle(width / 2, 40, width * 0.8, 30, 0x0c1a2f, 0.35);
        }

        slotPosition(unit: RenderUnit) {
          const padding = 50;
          const usableWidth = width - padding * 2;
          const columns = 5;
          const x = padding + (usableWidth / columns) * (unit.slot + 0.5);
          const y = unit.team === "ally" ? height * 0.68 : height * 0.28;
          return { x, y };
        }

        drawBars(unit: RenderUnit, holder: UnitSprites) {
          holder.hpBar.clear();
          holder.energyBar.clear();
          const pos = this.slotPosition(unit);
          const hpPct = Math.max(0, unit.hp) / Math.max(1, unit.maxHp);
          holder.hpBar.fillStyle(0x132235, 1);
          holder.hpBar.fillRoundedRect(pos.x - 32, pos.y - 38, 64, 8, 4);
          holder.hpBar.fillStyle(0x5eead4, 1);
          holder.hpBar.fillRoundedRect(pos.x - 32, pos.y - 38, 64 * hpPct, 8, 4);

          const energyPct = Math.min(1, unit.energy / 100);
          holder.energyBar.fillStyle(0x0f172a, 1);
          holder.energyBar.fillRoundedRect(pos.x - 32, pos.y - 28, 64, 6, 3);
          holder.energyBar.fillStyle(0xa78bfa, 1);
          holder.energyBar.fillRoundedRect(pos.x - 32, pos.y - 28, 64 * energyPct, 6, 3);
        }

        syncUnits(list: RenderUnit[]) {
          list.forEach((unit) => {
            const existing = this.unitMap[unit.id];
            const pos = this.slotPosition(unit);
            if (!existing) {
              const baseColor = Phaser.Display.Color.HexStringToColor(unit.visual.body).color;
              const sprite = this.add.rectangle(pos.x, pos.y, 54, 54, baseColor);
              sprite.setStrokeStyle(3, Phaser.Display.Color.HexStringToColor(unit.visual.accent).color, 0.9);
              sprite.setOrigin(0.5);
              const hpBar = this.add.graphics();
              const energyBar = this.add.graphics();
              this.unitMap[unit.id] = { sprite, hpBar, energyBar, baseColor };
            }
            const holder = this.unitMap[unit.id];
            holder.sprite.x = pos.x;
            holder.sprite.y = pos.y;
            holder.baseColor = Phaser.Display.Color.HexStringToColor(unit.visual.body).color;
            holder.sprite.setFillStyle(holder.baseColor);
            holder.sprite.setStrokeStyle(3, Phaser.Display.Color.HexStringToColor(unit.visual.accent).color, 0.9);
            holder.sprite.setAlpha(unit.hp <= 0 ? 0.35 : 1);
            this.drawBars(unit, holder);
          });
        }

        playEvent(ev: AfkCombatEvent) {
          const targetId = ev.targetId ?? ev.sourceId;
          if (!targetId) return;
          const holder = this.unitMap[targetId];
          if (!holder) return;
          const baseY = holder.sprite.y - 26;
          const text = this.add
            .text(holder.sprite.x, baseY, `${ev.kind === "heal" ? "+" : "-"}${Math.round(ev.amount)}`, {
              fontFamily: "Inter, sans-serif",
              fontSize: "14px",
              color: ev.kind === "heal" ? "#8ff7d4" : ev.crit ? "#ffd166" : "#fca5a5",
            })
            .setOrigin(0.5);
          this.tweens.add({
            targets: text,
            y: baseY - 18,
            alpha: 0,
            duration: 500 / Math.max(0.5, speedRef.current),
            onComplete: () => text.destroy(),
          });
          if (holder.sprite?.setFillStyle) {
            const flashColor = ev.kind === "heal" ? 0x6ee7b7 : 0xf43f5e;
            const original = holder.baseColor ?? holder.sprite.fillColor;
            holder.sprite.setFillStyle(flashColor);
            this.time.delayedCall(200, () => holder.sprite.setFillStyle(original));
          }
        }
      }

      const scene = new BattleScene();
      const game = new Phaser.Game({
        type: Phaser.AUTO,
        width,
        height,
        parent: containerRef.current,
        backgroundColor: "#0b1222",
        scene,
        physics: { default: "arcade" },
      });

      sceneRef.current = scene;
      gameRef.current = game;
    }

    boot();

    return () => {
      mounted = false;
      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
      }
    };
  }, [height]);

  useEffect(() => {
    if (sceneRef.current && units.length) {
      sceneRef.current.syncUnits(units);
    }
  }, [units]);

  useEffect(() => {
    if (sceneRef.current && lastEvent) {
      sceneRef.current.playEvent(lastEvent);
    }
  }, [lastEvent]);

  return <div ref={containerRef} className={styles.battleCanvas} style={{ width: "100%", height }} />;
}
