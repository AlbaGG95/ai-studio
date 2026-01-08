"use client";

import { useEffect, useRef } from "react";
import type PhaserLib from "phaser";
import { createBootScene } from "./scenes/BootScene";

type PhaserModule = typeof import("phaser");

export type SceneFactory<TOptions = unknown> = (
  Phaser: PhaserModule,
  options?: TOptions
) => Phaser.Types.Scenes.SceneType;

type GameCanvasProps = {
  sceneFactory?: SceneFactory;
  sceneOptions?: unknown;
  backgroundColor?: string;
};

export default function GameCanvas({ sceneFactory, sceneOptions, backgroundColor }: GameCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const MIN_W = 2;
    const MIN_H = 2;
    let game: PhaserLib.Game | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let resizeHandler: (() => void) | null = null;
    let resizeRaf: number | null = null;
    let destroyAudioListeners: Array<() => void> = [];
    let isDestroyed = false;
    let lastSize: { width: number; height: number } | null = null;
    let resizeErrored = false;

    const getAudioContext = (): AudioContext | null => {
      if (!game || isDestroyed) return null;
      const soundManager = (game as { sound?: { context?: AudioContext } }).sound;
      const ctx = soundManager?.context;
      if (!ctx || ctx.state === "closed") return null;
      return ctx;
    };

    const safeResumeAudio = () => {
      const ctx = getAudioContext();
      if (!ctx || ctx.state !== "suspended") return;
      try {
        void ctx.resume();
      } catch {
        /* ignore invalid resume */
      }
    };

    const safeSuspendAudio = () => {
      const ctx = getAudioContext();
      if (!ctx || ctx.state !== "running") return;
      try {
        void ctx.suspend();
      } catch {
        /* ignore invalid suspend */
      }
    };

    const attachAudioLifecycle = () => {
      if (typeof document === "undefined" || typeof window === "undefined") return;

      const handleVisibility = () => {
        if (document.visibilityState === "hidden") {
          safeSuspendAudio();
        } else {
          safeResumeAudio();
        }
      };

      const handleBlur = () => safeSuspendAudio();
      const handleFocus = () => safeResumeAudio();

      document.addEventListener("visibilitychange", handleVisibility);
      window.addEventListener("blur", handleBlur);
      window.addEventListener("focus", handleFocus);

      destroyAudioListeners.push(() => document.removeEventListener("visibilitychange", handleVisibility));
      destroyAudioListeners.push(() => window.removeEventListener("blur", handleBlur));
      destroyAudioListeners.push(() => window.removeEventListener("focus", handleFocus));
    };

    const setup = async () => {
      const phaserModule = (await import("phaser")) as unknown as { default: PhaserModule };
      const Phaser = phaserModule.default as PhaserModule;
      if (!containerRef.current) return;

      const factory = sceneFactory ?? createBootScene;
      const SceneClass = factory(Phaser, sceneOptions);

      const getSize = (): { width: number; height: number } | null => {
        const el = containerRef.current;
        if (!el || !el.isConnected) return null;
        const rect = el.getBoundingClientRect();
        const width = Math.floor(rect?.width ?? 0);
        const height = Math.floor(rect?.height ?? 0);
        if (!Number.isFinite(width) || !Number.isFinite(height)) return null;
        if (width < MIN_W || height < MIN_H) return null;
        return { width, height };
      };

      const initialSize = getSize() ?? { width: 800, height: 600 };
      const { width, height } = initialSize;

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

      attachAudioLifecycle();
      safeResumeAudio();

      const applyResize = () => {
        if (resizeRaf) {
          cancelAnimationFrame(resizeRaf);
        }
        resizeRaf = requestAnimationFrame(() => {
          if (!game || (game as unknown as { isDestroyed?: boolean }).isDestroyed) return;
          const size = getSize();
          if (!size) return;
          if (lastSize && lastSize.width === size.width && lastSize.height === size.height) return;
          try {
            game.scale.resize(size.width, size.height);
            lastSize = size;
            resizeErrored = false;
          } catch (err) {
            if (!resizeErrored) {
              console.error("Phaser resize skipped due to error", err);
            }
            resizeErrored = true;
          }
        });
      };

      if (typeof ResizeObserver !== "undefined" && containerRef.current) {
        resizeObserver = new ResizeObserver(applyResize);
        resizeObserver.observe(containerRef.current);
      } else if (typeof window !== "undefined") {
        resizeHandler = applyResize;
        window.addEventListener("resize", resizeHandler);
      }

      requestAnimationFrame(applyResize);
      requestAnimationFrame(applyResize);
    };

    setup();

    return () => {
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      if (resizeHandler) {
        window.removeEventListener("resize", resizeHandler);
      }
      if (resizeRaf) {
        cancelAnimationFrame(resizeRaf);
      }
      destroyAudioListeners.forEach((off) => off());
      destroyAudioListeners = [];
      isDestroyed = true;
      if (game) {
        game.destroy(true);
        game = null;
      }
    };
  }, [sceneFactory, backgroundColor, sceneOptions]);

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
