"use client";

import { useEffect, useRef, useState } from "react";
import { Application } from "pixi.js";
import {
  GeneratedHero,
  VisualDNA,
  generateTeam,
  simulateCombatTimeline,
  Stage,
} from "@ai-studio/core";
import { BattleRenderer } from "@ai-studio/render-pixi";

import styles from "./battle.module.css";

const WIDTH = 960;
const HEIGHT = 560;

function buildStage(index: number): Stage {
  const enemyPower = 240 + index * 55;
  return {
    id: `1-${index}`,
    chapter: 1,
    index,
    recommendedPower: 540 + index * 70,
    enemyPower,
    reward: { gold: 40 + index * 10, exp: 35 + index * 8, materials: 10 + index * 3 },
    unlocked: true,
  };
}

function visualMap(heroes: GeneratedHero[]): Record<string, VisualDNA | undefined> {
  return heroes.reduce<Record<string, VisualDNA | undefined>>((acc, hero) => {
    acc[hero.id] = hero.visuals;
    return acc;
  }, {});
}

function buildVisuals(allies: GeneratedHero[], enemyStageId: string) {
  const visuals = visualMap(allies);
  const enemyPalette = generateTeam(`enemy-visual-${enemyStageId}`, 5);
  enemyPalette.forEach((enemy, idx) => {
    visuals[`enemy-${enemyStageId}-${idx}`] = enemy.visuals;
  });
  return visuals;
}

function parseStageIndex(nodeId: string | null, fallback: number) {
  if (!nodeId) return fallback;
  const match = nodeId.match(/\d+/g);
  if (!match || !match.length) return fallback;
  const num = Number(match[match.length - 1]);
  return Number.isFinite(num) ? num : fallback;
}

export default function AfkBattlePage() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<BattleRenderer | null>(null);
  const appRef = useRef<Application | null>(null);
  const speedRef = useRef(1);
  const [nodeIdParam, setNodeIdParam] = useState<string | null>(null);
  const [seedParam, setSeedParam] = useState<string | null>(null);
  const initialStageIndex = parseStageIndex(nodeIdParam, 1);
  const [speed, setSpeed] = useState(1);
  const [stageIndex, setStageIndex] = useState(initialStageIndex);
  const [status, setStatus] = useState("Ready");
  const [result, setResult] = useState<"win" | "loss" | "timeout" | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    setNodeIdParam(params.get("nodeId"));
    setSeedParam(params.get("seed"));
  }, []);

  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  useEffect(() => {
    let disposed = false;
    const mount = mountRef.current;
    if (!mount) return () => {};

    const setup = async () => {
      const app = new Application();
      await app.init({ width: WIDTH, height: HEIGHT, background: "#0b1224", antialias: true });
      if (disposed) {
        app.destroy(true);
        return;
      }

      mount.innerHTML = "";
      const view = (app as any).canvas ?? (app as any).view;
      if (!view) throw new Error("Pixi view missing");
      mount.appendChild(view);
      appRef.current = app;

      const nodeId = nodeIdParam ?? `1-${stageIndex}`;
      const seed = seedParam ?? `afk-${nodeId}`;
      const allies = generateTeam(`demo-ally-${nodeId}`, 5);
      const stage = buildStage(parseStageIndex(nodeId, stageIndex));
      const timeline = simulateCombatTimeline(allies, stage, [], { tickMs: 620 }, seed);
      const frames = timeline.frames;
      if (!frames.length) return;

      const renderer = new BattleRenderer(app, {
        width: WIDTH,
        height: HEIGHT,
        visuals: buildVisuals(allies, stage.id),
      });
      rendererRef.current = renderer;

      renderer.renderFrame(frames[0]);
      setResult(null);
      setStatus(`Stage ${nodeId} running...`);

      let frameIdx = 0;
      let elapsed = 0;

      const tick = () => {
        if (!rendererRef.current) return;
        const deltaMs = app.ticker.deltaMS * speedRef.current;
        elapsed += deltaMs;
        while (frameIdx < frames.length - 1 && elapsed >= frames[frameIdx + 1].timestamp) {
          frameIdx += 1;
          rendererRef.current.renderFrame(frames[frameIdx]);
        }
        rendererRef.current.update(deltaMs);
        if (frameIdx >= frames.length - 1) {
          setResult(timeline.summary.result);
          setStatus(`Result: ${timeline.summary.result}`);
          app.ticker.remove(tick);
        }
      };

      app.ticker.add(tick);
    };

    setup();

    return () => {
      disposed = true;
      rendererRef.current?.destroy();
      rendererRef.current = null;
      appRef.current?.destroy(true);
      appRef.current = null;
    };
  }, [stageIndex, nodeIdParam, seedParam]);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <p className={styles.kicker}>AFK Vertical Slice</p>
          <h1 className={styles.title}>Battle Renderer (Pixi)</h1>
          <p className={styles.subtle}>
            Combate 5v5 generado proceduralmente. El renderer solo consume snapshots y eventos del engine.
          </p>
          <p className={styles.subtle}>Stage: {nodeIdParam ?? `1-${stageIndex}`}</p>
        </div>
        <div className={styles.controls}>
          <button onClick={() => setSpeed((s) => (s === 1 ? 2 : 1))}>
            Velocidad x{speed}
          </button>
          <button
            onClick={() => {
              setStageIndex((s) => s + 1);
            }}
          >
            Next stage
          </button>
        </div>
      </div>

      <div className={styles.canvasShell}>
        <div ref={mountRef} className={styles.canvas} />
        <div className={styles.overlay}>
          <div>
            <p className={styles.status}>Stage {nodeIdParam ?? stageIndex}</p>
            <p className={styles.statusDetail}>{status}</p>
          </div>
          <div className={styles.badges}>
            {result && (
              <span
                className={`${styles.badge} ${
                  result === "win" ? styles.win : result === "loss" ? styles.loss : styles.timeout
                }`}
              >
                {result}
              </span>
            )}
          </div>
        </div>
      </div>

      <p className={styles.hint}>
        Usa “Next stage” para regenerar equipos con otra seed. El toggle x1/x2 solo acelera el tick del driver.
      </p>
    </div>
  );
}
