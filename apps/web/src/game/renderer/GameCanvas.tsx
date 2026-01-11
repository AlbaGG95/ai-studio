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
  const hostRef = useRef<HTMLDivElement | null>(null);
  const gameRef = useRef<PhaserLib.Game | null>(null);
  const isBootedRef = useRef(false);
  const lastSizeRef = useRef<{ width: number; height: number } | null>(null);
  const lastGoodSizeRef = useRef<{ width: number; height: number } | null>(null);
  const pendingBootRafRef = useRef<number | null>(null);
  const pendingResizeRafRef = useRef<number | null>(null);
  const pendingResizeTimeoutRef = useRef<number | null>(null);
  const bootRetryTimeoutRef = useRef<number | null>(null);
  const bootAttemptsRef = useRef(0);
  const lastBootWarnTimeRef = useRef(0);
  const lastBootWarnSizeRef = useRef<{ width: number; height: number } | null>(null);
  const lastInvalidWarnTimeRef = useRef(0);
  const lastInvalidWarnSizeRef = useRef<{ width: number; height: number } | null>(null);
  const fallbackToCanvasRef = useRef(false);

  useEffect(() => {
    const MIN_W = 2;
    const MIN_H = 2;
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
    lastGoodSizeRef.current = null;
    lastBootWarnTimeRef.current = 0;
    lastBootWarnSizeRef.current = null;
    lastInvalidWarnTimeRef.current = 0;
    lastInvalidWarnSizeRef.current = null;
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

    const isValidSize = (size: { width: number; height: number } | null | undefined) => {
      if (!size) return false;
      const { width, height } = size;
      return Number.isFinite(width) && Number.isFinite(height) && width > 1 && height > 1;
    };

    const measureHost = (entry?: ResizeObserverEntry | null): { width: number; height: number } | null => {
      const el = hostRef.current;
      if (!el || !el.isConnected) return null;
      const rect = entry?.contentRect ?? el.getBoundingClientRect?.();
      const width = Math.floor(rect?.width ?? 0);
      const height = Math.floor(rect?.height ?? 0);
      if (!Number.isFinite(width) || !Number.isFinite(height)) return null;
      return { width, height };
    };

    const warnInvalidSize = (size: { width: number; height: number } | null) => {
      if (!size) return;
      const now = Date.now();
      const lastWarnTime = lastInvalidWarnTimeRef.current;
      const lastWarnSize = lastInvalidWarnSizeRef.current;
      const sizeChanged =
        !lastWarnSize || lastWarnSize.width !== size.width || lastWarnSize.height !== size.height;
      if (!sizeChanged && now - lastWarnTime < 1000) return;
      console.warn(`GameCanvas resize ignored (w=${size.width}, h=${size.height})`);
      lastInvalidWarnTimeRef.current = now;
      lastInvalidWarnSizeRef.current = size;
    };

    const getSafeSize = (entry?: ResizeObserverEntry | null): { width: number; height: number } | null => {
      const size = measureHost(entry);
      if (!isValidSize(size)) {
        warnInvalidSize(size);
        return null;
      }
      lastGoodSizeRef.current = size;
      return size;
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

    const clearResizeTimeout = () => {
      if (pendingResizeTimeoutRef.current !== null) {
        clearTimeout(pendingResizeTimeoutRef.current);
        pendingResizeTimeoutRef.current = null;
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
        const fallbackSize = lastSizeRef.current ?? lastGoodSizeRef.current ?? getSafeSize();
        destroyGame();
        if (fallbackSize) {
          createGame(fallbackSize);
        }
      };
      window.addEventListener("error", handleError);
      return () => window.removeEventListener("error", handleError);
    };

    const createGame = (size: { width: number; height: number }) => {
      if (!hostRef.current || !Phaser || !SceneClass) return;
      if (!isValidSize(size)) return;
      if (size.width < MIN_W || size.height < MIN_H) return;

      const renderType = fallbackToCanvasRef.current ? Phaser.CANVAS : Phaser.WEBGL;
      const resolution =
        typeof window !== "undefined" ? Math.min(window.devicePixelRatio || 1, 2) : 1;
      const config: Phaser.Types.Core.GameConfig & { resolution: number } = {
        type: renderType,
        width: size.width,
        height: size.height,
        parent: hostRef.current,
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
        lastGoodSizeRef.current = size;
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
      if (!isValidSize(size)) return;
      if (!gameRef.current) return;
      const lastSize = lastSizeRef.current;
      if (lastSize && lastSize.width === size.width && lastSize.height === size.height) return;
      try {
        gameRef.current.scale.resize(size.width, size.height);
        lastSizeRef.current = size;
        lastGoodSizeRef.current = size;
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
        clearBootRetryTimeout();
        clearBootRaf();
      }

      if (pendingBootRafRef.current) return;
      pendingBootRafRef.current = requestAnimationFrame(() => {
        pendingBootRafRef.current = requestAnimationFrame(() => {
          pendingBootRafRef.current = null;
          if (isDestroyed || gameRef.current) return;
          const measuredSize = measureHost();
          if (!measuredSize) {
            bootAttemptsRef.current += 1;
            clearBootRetryTimeout();
            const retryDelay = Math.min(BOOT_RETRY_DELAY_MS * Math.max(1, bootAttemptsRef.current), 1000);
            bootRetryTimeoutRef.current = window.setTimeout(() => {
              bootRetryTimeoutRef.current = null;
              scheduleBoot();
            }, retryDelay);
            return;
          }

          if (!isValidSize(measuredSize) || measuredSize.width < MIN_W || measuredSize.height < MIN_H) {
            bootAttemptsRef.current += 1;
            const now = Date.now();
            const lastWarnTime = lastBootWarnTimeRef.current;
            const lastWarnSize = lastBootWarnSizeRef.current;
            const sizeChanged =
              !lastWarnSize ||
              lastWarnSize.width !== measuredSize.width ||
              lastWarnSize.height !== measuredSize.height;
            if (sizeChanged || now - lastWarnTime >= 1000) {
              console.warn(
                `Phaser boot delayed: container has no valid size yet (w=${measuredSize.width}, h=${measuredSize.height})`
              );
              lastBootWarnTimeRef.current = now;
              lastBootWarnSizeRef.current = measuredSize;
            }
            clearBootRetryTimeout();
            const retryDelay = Math.min(BOOT_RETRY_DELAY_MS * Math.max(1, bootAttemptsRef.current), 1000);
            bootRetryTimeoutRef.current = window.setTimeout(() => {
              bootRetryTimeoutRef.current = null;
              scheduleBoot();
            }, retryDelay);
            return;
          }

          bootAttemptsRef.current = 0;
          lastBootWarnSizeRef.current = null;
          lastGoodSizeRef.current = measuredSize;
          createGame(measuredSize);
        });
      });
    };

    const scheduleResize = (entry?: ResizeObserverEntry) => {
      if (isDestroyed) return;
      const size = getSafeSize(entry);
      if (!size) return;
      if (!gameRef.current) {
        scheduleBoot(true);
      }
      clearResizeTimeout();
      clearResizeRaf();
      pendingResizeTimeoutRef.current = window.setTimeout(() => {
        pendingResizeTimeoutRef.current = null;
        if (isDestroyed) return;
        const targetSize = lastGoodSizeRef.current ?? size;
        if (!isValidSize(targetSize)) return;
        pendingResizeRafRef.current = requestAnimationFrame(() => {
          pendingResizeRafRef.current = null;
          if (isDestroyed) return;
          if (!gameRef.current) {
            scheduleBoot(true);
            return;
          }
          safeResize(targetSize);
        });
      }, 120);
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

    if (typeof ResizeObserver !== "undefined" && hostRef.current) {
      resizeObserver = new ResizeObserver((entries) => {
        const entry = entries[entries.length - 1];
        scheduleResize(entry);
      });
      resizeObserver.observe(hostRef.current);
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
      clearResizeTimeout();
      destroyAudioListeners.forEach((off) => off());
      destroyAudioListeners = [];
      isDestroyed = true;
      destroyGame();
    };
  }, [sceneFactory, backgroundColor, sceneOptions]);

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        flex: 1,
        minHeight: 0,
        minWidth: 0,
        overflow: "hidden",
      }}
    >
      <div
        ref={hostRef}
        style={{
          position: "absolute",
          inset: 0,
          minWidth: 0,
          minHeight: 0,
          overflow: "hidden",
          display: "block",
        }}
      />
    </div>
  );
}
