"use client";

import Phaser from "phaser";
import { useEffect, useMemo, useRef } from "react";
import { AfkCombatEvent, AfkHeroVisual } from "@ai-studio/core";
import { biomeForStage, buildHeroArtProfile, HeroArtProfile } from "@/lib/afkProcedural";
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
  role?: "tank" | "fighter" | "ranger" | "support" | "mage";
  rarity?: "common" | "rare" | "epic" | "legendary";
  visualSeed?: string;
}

type Props = {
  units: RenderUnit[];
  lastEvent: AfkCombatEvent | null;
  speed: number;
  height?: number;
  stageId?: string;
};

type UnitSprites = {
  container: Phaser.GameObjects.Container;
  sprite: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Ellipse;
  hpBar: Phaser.GameObjects.Graphics;
  energyBar: Phaser.GameObjects.Graphics;
  aura: Phaser.GameObjects.Graphics;
  idleTween?: Phaser.Tweens.Tween;
  isDead?: boolean;
};

function makeHeroTexture(scene: Phaser.Scene, unit: RenderUnit, profile: HeroArtProfile) {
  const textureKey = `hero-body-${unit.id}`;
  if (scene.textures.exists(textureKey)) return textureKey;
  const g = scene.add.graphics();
  g.fillStyle(0xffffff, 0);
  g.fillRect(0, 0, 140, 170);
  g.fillStyle(Phaser.Display.Color.HexStringToColor(profile.palette.primary).color, 1);
  g.fillRoundedRect(42, 46, 56, 92, 18);
  g.lineStyle(3, Phaser.Display.Color.HexStringToColor(profile.palette.accent).color, 0.9);
  g.strokeRoundedRect(40, 44, 60, 96, 18);
  g.fillStyle(Phaser.Display.Color.HexStringToColor(profile.palette.secondary).color, 1);
  g.fillRoundedRect(48, 52, 44, 32, 14);
  g.fillStyle(Phaser.Display.Color.HexStringToColor(profile.palette.glow).color, 0.9);
  g.fillEllipse(64, 64, 14, 10);
  g.fillEllipse(80, 64, 14, 10);
  g.fillStyle(Phaser.Display.Color.HexStringToColor(profile.palette.accent).color, 0.85);
  g.fillRoundedRect(50, 98, 38, 18, 8);
  g.generateTexture(textureKey, 140, 170);
  g.destroy();
  return textureKey;
}

export function PhaserBattle({ units, lastEvent, speed, height = 520, stageId }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<any>(null);
  const gameRef = useRef<any>(null);
  const speedRef = useRef<number>(speed);

  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  const stageDescriptor = useMemo(() => {
    const id = stageId ?? "1-1";
    const index = Number(id.split("-")[1] ?? "1");
    return { id, chapter: 1, index, recommendedPower: 0, enemyPower: 0, reward: { gold: 0, exp: 0, materials: 0 }, unlocked: true };
  }, [stageId]);

  useEffect(() => {
    let mounted = true;
    async function boot() {
      const Phaser = (await import("phaser")).default;
      if (!mounted || gameRef.current || !containerRef.current) return;
      const width = containerRef.current.clientWidth || 380;
      const biome = biomeForStage(stageDescriptor as any);

      class BattleScene extends Phaser.Scene {
        unitMap: Record<string, UnitSprites> = {};
        stateMap: Record<string, RenderUnit> = {};

        constructor() {
          super("afk-battle");
        }

        create() {
          this.cameras.main.setBackgroundColor(biome.palette.sky);
          const ground = this.add.graphics();
          ground.fillStyle(Phaser.Display.Color.HexStringToColor(biome.palette.ground).color, 0.95);
          ground.fillRoundedRect(width * 0.08, height * 0.62, width * 0.84, height * 0.18, 24);
          ground.fillStyle(Phaser.Display.Color.HexStringToColor(biome.palette.mist).color, 0.35);
          ground.fillEllipse(width / 2, height * 0.36, width * 0.9, 180);
          this.add.rectangle(width / 2, height - 30, width * 0.8, 50, Phaser.Display.Color.HexStringToColor(biome.palette.accent).color, 0.08);
          this.add.rectangle(width / 2, 40, width * 0.6, 30, 0xffffff, 0.05);
        }

        slotPosition(unit: RenderUnit) {
          const padding = 50;
          const usableWidth = width - padding * 2;
          const columns = 5;
          const x = padding + (usableWidth / columns) * (unit.slot + 0.5);
          const y = unit.team === "ally" ? height * 0.7 : height * 0.32;
          return { x, y };
        }

        drawBars(unit: RenderUnit, holder: UnitSprites) {
          holder.hpBar.clear();
          holder.energyBar.clear();
          const pos = this.slotPosition(unit);
          const hpPct = Math.max(0, unit.hp) / Math.max(1, unit.maxHp);
          holder.hpBar.fillStyle(0x0b1627, 0.9);
          holder.hpBar.fillRoundedRect(pos.x - 44, pos.y - 56, 88, 12, 6);
          holder.hpBar.fillStyle(0x5eead4, 1);
          holder.hpBar.fillRoundedRect(pos.x - 44, pos.y - 56, 88 * hpPct, 12, 6);

          const energyPct = Math.min(1, unit.energy / 100);
          holder.energyBar.fillStyle(0x0f172a, 1);
          holder.energyBar.fillRoundedRect(pos.x - 44, pos.y - 40, 88, 9, 5);
          holder.energyBar.fillStyle(0xa78bfa, 1);
          holder.energyBar.fillRoundedRect(pos.x - 44, pos.y - 40, 88 * energyPct, 9, 5);
        }

        syncUnits(list: RenderUnit[]) {
          this.stateMap = Object.fromEntries(list.map((u) => [u.id, u]));
          list.forEach((unit) => {
            const existing = this.unitMap[unit.id];
            const pos = this.slotPosition(unit);
            if (!existing) {
              const profile = buildHeroArtProfile({
                visualSeed: unit.visualSeed ?? unit.id,
                role: unit.role ?? "fighter",
                rarity: unit.rarity ?? "common",
                id: unit.id,
              });
              const textureKey = makeHeroTexture(this, unit, profile);
              const sprite = this.add.image(pos.x, pos.y, textureKey);
              sprite.setOrigin(0.5);
              sprite.setScale(unit.team === "ally" ? 1.05 : -1.05, 1.05);
              const shadow = this.add.ellipse(pos.x, pos.y + 38, 90, 22, 0x000000, 0.4);
              shadow.setScale(1, 0.72);
              const aura = this.add.graphics();
              aura.fillStyle(Phaser.Display.Color.HexStringToColor(profile.palette.accent).color, 0.18);
              aura.fillEllipse(pos.x, pos.y + 10, 76, 32);
              const hpBar = this.add.graphics();
              const energyBar = this.add.graphics();
              const container = this.add.container(0, 0, [shadow, aura, sprite]);
              container.setDepth(unit.team === "ally" ? 2 : 1);
              const idleTween = this.tweens.add({
                targets: container,
                y: "+=6",
                duration: 1500,
                yoyo: true,
                repeat: -1,
                ease: "sine.inOut",
              });
              this.unitMap[unit.id] = { container, sprite, shadow, hpBar, energyBar, aura, idleTween };
            }
            const holder = this.unitMap[unit.id];
            holder.container.x = pos.x;
            holder.container.y = pos.y;
            holder.shadow.x = pos.x;
            holder.shadow.y = pos.y + 38;
            holder.aura.x = pos.x;
            holder.aura.y = pos.y + 10;
            holder.sprite.setAlpha(unit.hp <= 0 ? 0.28 : 1);
            holder.shadow.setAlpha(unit.hp <= 0 ? 0.15 : 0.4);
            holder.aura.setAlpha(unit.hp <= 0 ? 0.1 : 0.18);
            this.drawBars(unit, holder);
          });
        }

        playEvent(ev: AfkCombatEvent) {
          const targetId = ev.targetId ?? ev.sourceId;
          const source = ev.sourceId ? this.unitMap[ev.sourceId] : undefined;
          const target = targetId ? this.unitMap[targetId] : undefined;
          const targetState = targetId ? this.stateMap[targetId] : undefined;
          if (source) {
            this.tweens.add({
              targets: source.container,
              x: source.container.x + (ev.team === "ally" ? 16 : -16),
              y: source.container.y - 6,
              duration: 200 / Math.max(1, speedRef.current),
              yoyo: true,
              ease: "sine.inOut",
            });
          }
          if (target) {
            const baseY = target.container.y - 52;
            const text = this.add
              .text(target.container.x, baseY, `${ev.kind === "heal" ? "+" : "-"}${Math.round(ev.amount)}`, {
                fontFamily: "Inter, sans-serif",
                fontSize: "16px",
                color: ev.kind === "heal" ? "#8ff7d4" : ev.crit ? "#ffd166" : "#fca5a5",
                fontStyle: ev.crit ? "bold" : "normal",
              })
              .setOrigin(0.5);
            this.tweens.add({
              targets: text,
              y: baseY - 24,
              alpha: 0,
              duration: 620 / Math.max(1, speedRef.current),
              ease: "quad.out",
              onComplete: () => text.destroy(),
            });
            this.tweens.add({
              targets: target.container,
              angle: ev.kind === "heal" ? 0 : ev.team === "ally" ? -3 : 3,
              duration: 160 / Math.max(1, speedRef.current),
              yoyo: true,
            });
            if (targetState && ev.kind === "death") {
              this.tweens.add({
                targets: target.container,
                alpha: 0,
                scale: 0.9,
                duration: 360,
                ease: "quad.in",
              });
              target.isDead = true;
            }
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
  }, [height, stageDescriptor]);

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
