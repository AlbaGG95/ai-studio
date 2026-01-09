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
  const gameRef = useRef<PhaserLib.Game | null>(null);
  const isBootedRef = useRef(false);
  const lastSizeRef = useRef<{ width: number; height: number } | null>(null);
  const pendingBootRafRef = useRef<number | null>(null);
  const pendingResizeRafRef = useRef<number | null>(null);
  const bootRetryTimeoutRef = useRef<number | null>(null);
  const bootAttemptsRef = useRef(0);
  const bootWarnedRef = useRef(false);
  const fallbackToCanvasRef = useRef(false);

  useEffect(() => {
    const MIN_W = 2;
    const MIN_H = 2;
    const MAX_BOOT_ATTEMPTS = 60;
    const BOOT_RETRY_DELAY_MS = 50;
    let resizeObserver: ResizeObserver | null = null;
    let resizeHandler: (() => void) | null = null;
    let destroyAudioListeners: Array<() => void> = [];
    let isDestroyed = false;
    let resizeErrored = false;
    let audioBound = false;
    let bootErrorCleanup: (() => void) | null = null;
    let Phaser: PhaserModule | null = null;
    let SceneClass: Phaser.Types.Scenes.SceneType | null = null;

    isBootedRef.current = false;
    lastSizeRef.current = null;
    fallbackToCanvasRef.current = false;

    const getAudioContext = (): AudioContext | null => {
      const game = gameRef.current;
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

    const getSafeSize = (): { width: number; height: number } | null => {
      const el = containerRef.current;
      if (!el || !el.isConnected) return null;
      const rect = el.getBoundingClientRect();
      const width = Math.floor(rect?.width ?? 0);
      const height = Math.floor(rect?.height ?? 0);
      if (!Number.isFinite(width) || !Number.isFinite(height)) return null;
      if (width < MIN_W || height < MIN_H) return null;
      return { width, height };
    };

    const clearBootRetryTimeout = () => {
      if (bootRetryTimeoutRef.current !== null) {
        clearTimeout(bootRetryTimeoutRef.current);
        bootRetryTimeoutRef.current = null;
      }
    };

    const clearBootRaf = () => {
      if (pendingBootRafRef.current) {
        cancelAnimationFrame(pendingBootRafRef.current);
        pendingBootRafRef.current = null;
      }
    };

    const clearResizeRaf = () => {
      if (pendingResizeRafRef.current) {
        cancelAnimationFrame(pendingResizeRafRef.current);
        pendingResizeRafRef.current = null;
      }
    };

    const getErrorMessage = (err: unknown) => {
      if (err instanceof Error) return err.message;
      if (typeof err === "string") return err;
      try {
        return JSON.stringify(err);
      } catch {
        return String(err);
      }
    };

    const isWebGlFramebufferError = (err: unknown) => {
      const message = getErrorMessage(err);
      return /incomplete attachment|framebuffer|webgl/i.test(message);
    };

    const destroyGame = () => {
      if (bootErrorCleanup) {
        bootErrorCleanup();
        bootErrorCleanup = null;
      }
      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
      }
      isBootedRef.current = false;
    };

    const attachBootErrorGuard = () => {
      if (typeof window === "undefined") return null;
      const handleError = (event: ErrorEvent) => {
        if (isDestroyed || fallbackToCanvasRef.current) return;
        if (isBootedRef.current) return;
        const errorPayload = event.error ?? event.message;
        if (!isWebGlFramebufferError(errorPayload)) return;
        event.preventDefault();
        fallbackToCanvasRef.current = true;
        const fallbackSize = lastSizeRef.current ?? getSafeSize();
        destroyGame();
        if (fallbackSize) {
          createGame(fallbackSize);
        }
      };
      window.addEventListener("error", handleError);
      return () => window.removeEventListener("error", handleError);
    };

    const createGame = (size: { width: number; height: number }) => {
      if (!containerRef.current || !Phaser || !SceneClass) return;
      if (!Number.isFinite(size.width) || !Number.isFinite(size.height)) return;
      if (size.width < MIN_W || size.height < MIN_H) return;

      const renderType = fallbackToCanvasRef.current ? Phaser.CANVAS : Phaser.WEBGL;
      const resolution =
        typeof window !== "undefined" ? Math.min(window.devicePixelRatio || 1, 2) : 1;
      const config: Phaser.Types.Core.GameConfig & { resolution: number } = {
        type: renderType,
        width: size.width,
        height: size.height,
        parent: containerRef.current,
        backgroundColor: backgroundColor ?? "#030712",
        resolution,
        scale: {
          mode: Phaser.Scale.FIT,
          autoCenter: Phaser.Scale.CENTER_BOTH,
          width: size.width,
          height: size.height,
        },
        scene: [SceneClass],
        disableContextMenu: true,
      };

      const startGame = (gameConfig: Phaser.Types.Core.GameConfig & { resolution: number }) => {
        const newGame = new Phaser.Game(gameConfig);
        gameRef.current = newGame;
        lastSizeRef.current = size;
        isBootedRef.current = false;
        newGame.events?.once?.(Phaser.Core.Events.READY, () => {
          isBootedRef.current = true;
          if (bootErrorCleanup) {
            bootErrorCleanup();
            bootErrorCleanup = null;
          }
        });
        if (!audioBound) {
          attachAudioLifecycle();
          audioBound = true;
        }
        safeResumeAudio();
        resizeErrored = false;
        return newGame;
      };

      try {
        if (renderType === Phaser.WEBGL) {
          bootErrorCleanup = attachBootErrorGuard();
        }
        startGame(config);
      } catch (err) {
        if (renderType === Phaser.WEBGL) {
          fallbackToCanvasRef.current = true;
          destroyGame();
          try {
            startGame({ ...config, type: Phaser.CANVAS });
          } catch (fallbackErr) {
            console.error("Phaser boot failed after Canvas fallback", fallbackErr);
          }
        } else {
          console.error("Phaser boot failed", err);
        }
      }
    };

    const safeResize = (size: { width: number; height: number }) => {
      if (!gameRef.current) return;
      const lastSize = lastSizeRef.current;
      if (lastSize && lastSize.width === size.width && lastSize.height === size.height) return;
      try {
        gameRef.current.scale.resize(size.width, size.height);
        lastSizeRef.current = size;
        resizeErrored = false;
      } catch (err) {
        if (isWebGlFramebufferError(err) && !fallbackToCanvasRef.current) {
          fallbackToCanvasRef.current = true;
          const fallbackSize = lastSizeRef.current ?? size;
          destroyGame();
          if (fallbackSize) {
            createGame(fallbackSize);
          }
          return;
        }
        if (!resizeErrored) {
          console.error("Phaser resize skipped due to error", err);
        }
        resizeErrored = true;
      }
    };

    const scheduleBoot = (resetAttempts = false) => {
      if (isDestroyed || gameRef.current) return;
      if (!Phaser || !SceneClass) return;

      if (resetAttempts) {
        bootAttemptsRef.current = 0;
        bootWarnedRef.current = false;
        clearBootRetryTimeout();
        clearBootRaf();
      }

      if (pendingBootRafRef.current) return;
      pendingBootRafRef.current = requestAnimationFrame(() => {
        pendingBootRafRef.current = requestAnimationFrame(() => {
          pendingBootRafRef.current = null;
          if (isDestroyed || gameRef.current) return;
          const size = getSafeSize();
          if (!size) {
            if (bootAttemptsRef.current < MAX_BOOT_ATTEMPTS) {
              bootAttemptsRef.current += 1;
              clearBootRetryTimeout();
              bootRetryTimeoutRef.current = window.setTimeout(() => {
                bootRetryTimeoutRef.current = null;
                scheduleBoot();
              }, BOOT_RETRY_DELAY_MS);
            } else if (!bootWarnedRef.current) {
              console.warn("Phaser boot delayed: container has no valid size yet");
              bootWarnedRef.current = true;
            }
            return;
          }
          bootAttemptsRef.current = 0;
          bootWarnedRef.current = false;
          createGame(size);
        });
      });
    };

    const scheduleResize = () => {
      if (isDestroyed) return;
      if (!gameRef.current) {
        scheduleBoot(true);
        return;
      }
      if (pendingResizeRafRef.current) return;
      pendingResizeRafRef.current = requestAnimationFrame(() => {
        pendingResizeRafRef.current = requestAnimationFrame(() => {
          pendingResizeRafRef.current = null;
          if (isDestroyed) return;
          const size = getSafeSize();
          if (!size) return;
          safeResize(size);
        });
      });
    };

    const setup = async () => {
      const phaserModule = (await import("phaser")) as unknown as { default: PhaserModule };
      if (isDestroyed) return;
      Phaser = phaserModule.default as PhaserModule;
      const factory = sceneFactory ?? createBootScene;
      SceneClass = factory(Phaser, sceneOptions);
      scheduleBoot(true);
    };

    setup();

    if (typeof ResizeObserver !== "undefined" && containerRef.current) {
      resizeObserver = new ResizeObserver(scheduleResize);
      resizeObserver.observe(containerRef.current);
    } else if (typeof window !== "undefined") {
      resizeHandler = scheduleResize;
      window.addEventListener("resize", resizeHandler);
    }

    scheduleResize();

    return () => {
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      if (resizeHandler) {
        window.removeEventListener("resize", resizeHandler);
      }
      clearBootRetryTimeout();
      clearBootRaf();
      clearResizeRaf();
      destroyAudioListeners.forEach((off) => off());
      destroyAudioListeners = [];
      isDestroyed = true;
      destroyGame();
    };
  }, [sceneFactory, backgroundColor, sceneOptions]);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        overflow: "hidden",
        borderRadius: 12,
      }}
    >
      <div
        ref={containerRef}
        style={{
          width: "100%",
          height: "100%",
          position: "relative",
          overflow: "hidden",
          minWidth: 2,
          minHeight: 2,
        }}
      />
    </div>
  );
}
