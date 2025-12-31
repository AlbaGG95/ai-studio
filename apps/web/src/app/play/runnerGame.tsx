"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./play.module.css";
import {
  RunnerState,
  RunnerConfig,
  createRunnerState,
  startRunner,
  stepRunner,
  restartRunner,
  DEFAULT_RUNNER_CONFIG,
} from "@ai-studio/core";

type RunnerProps = {
  title?: string;
  config?: Partial<RunnerConfig>;
};

export function RunnerGame({ title, config }: RunnerProps) {
  const mergedConfig: RunnerConfig = { ...DEFAULT_RUNNER_CONFIG, ...config };
  const [state, setState] = useState<RunnerState>(() => createRunnerState(mergedConfig));
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastFrame = useRef<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        jump();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  useEffect(() => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) {
      setError("Canvas no disponible");
      return;
    }
    const loop = (ts: number) => {
      if (!lastFrame.current) lastFrame.current = ts;
      const delta = ts - lastFrame.current;
      lastFrame.current = ts;
      setState((prev) => stepRunner(prev, delta, false));
      draw(ctx, state);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext("2d");
    if (ctx) draw(ctx, state);
  }, [state]);

  const start = () => {
    setState((s) => startRunner(s));
  };

  const restart = () => {
    setState(restartRunner(mergedConfig));
    lastFrame.current = null;
  };

  const jump = () => {
    setState((s) => stepRunner(s, 0, true));
  };

  const draw = (ctx: CanvasRenderingContext2D, s: RunnerState) => {
    const { width, height, groundY } = s.config;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#0b1220";
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = "#16233b";
    ctx.fillRect(0, groundY, width, height - groundY);
    // player
    ctx.fillStyle = "#7cf0ff";
    ctx.fillRect(s.player.x, s.player.y - 32, 26, 32);
    // obstacles
    ctx.fillStyle = "#ff6b6b";
    s.obstacles.forEach((o) => {
      ctx.fillRect(o.x, o.y - o.height, o.width, o.height);
    });
    // HUD
    ctx.fillStyle = "#e9edf5";
    ctx.font = "14px sans-serif";
    ctx.fillText(`Score: ${s.score}`, 10, 20);
    ctx.fillText(s.running ? "RUN" : s.gameOver ? "GAME OVER" : "READY", width - 120, 20);
  };

  return (
    <div className={styles.card}>
      <div className={styles.panelHeader}>
        <div>
          <p className={styles.kicker}>Runner</p>
          <h2 className={styles.title}>{title || "Endless Runner"}</h2>
          <p className={styles.subtle}>Space/Click para saltar. Evita obstáculos.</p>
        </div>
        <div className={styles.actions}>
          <button onClick={start} disabled={state.running && !state.gameOver}>
            {state.gameOver ? "Restart" : state.running ? "Running..." : "Start"}
          </button>
          <button onClick={restart}>Reset</button>
        </div>
      </div>
      {error && <p className={styles.error}>{error}</p>}
      <canvas
        ref={canvasRef}
        width={mergedConfig.width}
        height={mergedConfig.height}
        onClick={() => jump()}
        style={{ width: "100%", background: "#0b1220", borderRadius: 12, border: "1px solid #1f2b46" }}
      />
    </div>
  );
}
