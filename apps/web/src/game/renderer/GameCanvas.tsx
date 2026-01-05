"use client";

import { useEffect, useRef } from "react";
import { createBootScene } from "./scenes/BootScene";
import type PhaserLib from "phaser";

type PhaserModule = typeof import("phaser");

export type SceneFactory = (Phaser: PhaserModule) => Phaser.Types.Scenes.SceneType;

type GameCanvasProps = {
  sceneFactory?: SceneFactory;
  backgroundColor?: string;
};

export default function GameCanvas({ sceneFactory, backgroundColor }: GameCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let game: PhaserLib.Game | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let resizeHandler: (() => void) | null = null;

    const setup = async () => {
      const phaserModule = (await import("phaser")) as unknown as { default: PhaserModule };
      const Phaser = phaserModule.default as PhaserModule;
      if (!containerRef.current) return;

      const factory = sceneFactory ?? createBootScene;
      const SceneClass = factory(Phaser);

      const getSize = () => {
        const rect = containerRef.current?.getBoundingClientRect();
        return {
          width: Math.max(1, Math.floor(rect?.width ?? 800)),
          height: Math.max(1, Math.floor(rect?.height ?? 600)),
        };
      };

      const { width, height } = getSize();

      game = new Phaser.Game({
        type: Phaser.AUTO,
        width,
        height,
        parent: containerRef.current,
        backgroundColor: backgroundColor ?? "#030712",
        scale: {
          mode: Phaser.Scale.FIT,
          autoCenter: Phaser.Scale.CENTER_BOTH,
          width,
          height,
        },
        scene: [SceneClass],
        disableContextMenu: true,
      });

      const applyResize = () => {
        if (!game) return;
        const { width: w, height: h } = getSize();
        game.scale.resize(w, h);
      };

      if (typeof ResizeObserver !== "undefined" && containerRef.current) {
        resizeObserver = new ResizeObserver(applyResize);
        resizeObserver.observe(containerRef.current);
      } else if (typeof window !== "undefined") {
        resizeHandler = applyResize;
        window.addEventListener("resize", resizeHandler);
      }
    };

    setup();

    return () => {
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      if (resizeHandler) {
        window.removeEventListener("resize", resizeHandler);
      }
      if (game) {
        game.destroy(true);
        game = null;
      }
    };
  }, [sceneFactory, backgroundColor]);

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        overflow: "hidden",
        borderRadius: 12,
      }}
    />
  );
}
