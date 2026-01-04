"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Application } from "pixi.js";
import { useRouter } from "next/navigation";
import {
  generateCampaignGraph,
  generateHero,
  generateTeam,
  simulateCombatTimeline,
  type AfkHero,
  type CampaignGraph,
  type CampaignNode,
  type Stage,
  type VisualDNA,
} from "@ai-studio/core";
import { BattleRenderer } from "@ai-studio/render-pixi";
import { loadProgress, loadRoster, saveProgress, type PlayerRoster, type ProgressState } from "@/lib/afk/storage";

import styles from "./battle.module.css";

const WIDTH = 960;
const HEIGHT = 560;
const GRAPH_SEED = 12345;

type BattlePhase = "idle" | "running" | "ending" | "ended";

type ConfettiPiece = {
  id: string;
  left: string;
  duration: number;
  delay: number;
  color: string;
  rotation: number;
};

function hashToUnit(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = Math.imul(31, hash) + input.charCodeAt(i);
  }
  return ((hash >>> 0) % 1000) / 999;
}

function flattenNodes(graph: CampaignGraph): CampaignNode[] {
  return graph.chapters
    .flatMap((chapter) => chapter.nodes)
    .sort((a, b) => (a.chapterIndex === b.chapterIndex ? a.index - b.index : a.chapterIndex - b.chapterIndex));
}

function findNode(graph: CampaignGraph, nodeId?: string | null): CampaignNode {
  const flat = flattenNodes(graph);
  const found = flat.find((n) => n.id === nodeId);
  return found ?? flat[0];
}

function nextNodeId(graph: CampaignGraph, nodeId: string): string | null {
  const flat = flattenNodes(graph);
  const idx = flat.findIndex((n) => n.id === nodeId);
  if (idx >= 0 && idx < flat.length - 1) return flat[idx + 1].id;
  return null;
}

function stageFromNode(node: CampaignNode): Stage {
  const materials = node.rewards.items?.reduce((acc, item) => acc + item.qty, 0) ?? Math.max(1, Math.round(node.recommendedPower * 0.012));
  return {
    id: node.id,
    chapter: node.chapterIndex + 1,
    index: node.index,
    recommendedPower: node.recommendedPower,
    enemyPower: Math.max(120, Math.round(node.recommendedPower * 0.95)),
    reward: { gold: node.rewards.gold, exp: node.rewards.exp, materials },
    unlocked: true,
  };
}

function heroVisual(hero: AfkHero): VisualDNA | undefined {
  const dna = (hero as any).visuals as VisualDNA | undefined;
  if (dna) return dna;
  const generated = generateHero(hero.visualSeed ?? hero.id, 0, hero.level ?? 1);
  return generated.visuals;
}

function buildVisuals(allies: AfkHero[], stageId: string): Record<string, VisualDNA | undefined> {
  const visuals: Record<string, VisualDNA | undefined> = {};
  allies.forEach((hero) => {
    visuals[hero.id] = heroVisual(hero);
  });
  const enemyVisuals = generateTeam(`enemy-visual-${stageId}`, 5);
  enemyVisuals.forEach((enemy, idx) => {
    visuals[`enemy-${stageId}-${idx}`] = enemy.visuals;
  });
  return visuals;
}

function buildAllies(roster: PlayerRoster): AfkHero[] {
  const heroes = roster.heroes ?? [];
  const team = roster.team && roster.team.length ? roster.team : heroes.slice(0, 5).map((h) => h.id);
  const selected = team
    .map((id) => heroes.find((h) => h.id === id))
    .filter(Boolean)
    .slice(0, 5) as AfkHero[];
  if (selected.length >= 5) return selected;
  const fallback = generateTeam(`ally-fallback-${team.join("-") || "seed"}`, 5 - selected.length);
  return [...selected, ...fallback.map((h) => ({ ...h }))].slice(0, 5) as AfkHero[];
}

function persistWinProgress(graph: CampaignGraph, nodeId: string): ProgressState {
  const base = loadProgress() ?? { currentNodeId: graph.startNodeId, cleared: {} as Record<string, true> };
  const cleared: Record<string, true> = { ...base.cleared, [nodeId]: true };
  const flat = flattenNodes(graph);
  const idx = flat.findIndex((n) => n.id === nodeId);
  const next = idx >= 0 && idx < flat.length - 1 ? flat[idx + 1].id : nodeId;
  const nextCurrent = next || base.currentNodeId || graph.startNodeId;
  const nextProgress = { currentNodeId: nextCurrent, cleared };
  saveProgress(nextProgress);
  return nextProgress;
}

function estimatePower(units: Array<{ hp: number; atk: number }>): number {
  return units.reduce((acc, unit) => acc + (unit.hp ?? 0) + (unit.atk ?? 0), 0);
}

function makeConfetti(seed: string, count = 26): ConfettiPiece[] {
  const palette = ["#7dd3fc", "#fbbf24", "#34d399", "#f472b6", "#c084fc"];
  const pieces: ConfettiPiece[] = [];
  for (let i = 0; i < count; i += 1) {
    const offset = hashToUnit(`${seed}-confetti-${i}`);
    pieces.push({
      id: `${seed}-${i}`,
      left: `${Math.round(offset * 90 + 5)}%`,
      duration: 900 + Math.round(hashToUnit(`${seed}-${i}-dur`) * 600),
      delay: Math.round(hashToUnit(`${seed}-${i}-delay`) * 320),
      color: palette[i % palette.length],
      rotation: Math.round(hashToUnit(`${seed}-${i}-rot`) * 240 - 120),
    });
  }
  return pieces;
}

export default function AfkBattlePage() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<BattleRenderer | null>(null);
  const appRef = useRef<Application | null>(null);
  const speedRef = useRef(1);
  const endedRef = useRef(false);
  const router = useRouter();

  const [speed, setSpeed] = useState(1);
  const [status, setStatus] = useState("Ready");
  const [battlePhase, setBattlePhase] = useState<BattlePhase>("idle");
  const [result, setResult] = useState<"win" | "loss" | "timeout" | null>(null);
  const [selectedNode, setSelectedNode] = useState<CampaignNode | null>(null);
  const [powerTotals, setPowerTotals] = useState<{ allies: number; enemies: number } | null>(null);
  const [confetti, setConfetti] = useState<ConfettiPiece[]>([]);
  const [battleKey, setBattleKey] = useState(0);
  const [queryNodeId, setQueryNodeId] = useState<string | null>(null);
  const [querySeed, setQuerySeed] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    setQueryNodeId(params.get("nodeId"));
    setQuerySeed(params.get("seed"));
  }, []);

  const graphSeed = useMemo(() => {
    const num = Number(querySeed ?? GRAPH_SEED);
    return Number.isFinite(num) ? num : GRAPH_SEED;
  }, [querySeed]);

  const graph = useMemo(
    () => generateCampaignGraph({ seed: graphSeed, chaptersCount: 8, nodesPerChapter: 10 }),
    [graphSeed]
  );

  const resolvedNodeId = useMemo(() => {
    const saved = typeof window !== "undefined" ? loadProgress()?.currentNodeId : null;
    return queryNodeId ?? saved ?? graph.startNodeId;
  }, [graph.startNodeId, queryNodeId]);

  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  useEffect(() => {
    let disposed = false;
    let endTimer: number | undefined;
    const mount = mountRef.current;
    if (!mount) return () => {};

    const setup = async () => {
      setBattlePhase("running");
      setResult(null);
      setConfetti([]);
      setPowerTotals(null);
      endedRef.current = false;
      setStatus("Preparando combate...");

      const node = findNode(graph, resolvedNodeId);
      setSelectedNode(node);
      const stage = stageFromNode(node);
      const battleSeed = `${querySeed ?? graphSeed}-${node.id}`;

      const roster = loadRoster();
      const allies = buildAllies(roster);
      const visuals = buildVisuals(allies, stage.id);

      const app = new Application();
      if (typeof (app as any).init === "function") {
        await (app as any).init({ width: WIDTH, height: HEIGHT, background: "#0b1224", antialias: true });
      } else {
        // Pixi v7 fallback
        // @ts-ignore renderer exists on Pixi v7
        (app as any).renderer?.resize?.(WIDTH, HEIGHT);
      }

      if (disposed) {
        try {
          app.destroy(true);
        } catch {
          // ignore
        }
        return;
      }

      mount.innerHTML = "";
      const view = (app as any).canvas ?? (app as any).view;
      if (!view) throw new Error("Pixi view missing");
      mount.appendChild(view);
      appRef.current = app;

      const timeline = simulateCombatTimeline(allies, stage, (roster as any).upgrades ?? [], { tickMs: 620 }, battleSeed);
      const frames = timeline.frames;
      if (!frames.length) {
        setStatus("No hay frames para renderizar");
        return;
      }

      const startFrame = frames[0];
      setPowerTotals({
        allies: estimatePower(startFrame.allies),
        enemies: estimatePower(startFrame.enemies),
      });

      const renderer = new BattleRenderer(app, { width: WIDTH, height: HEIGHT, visuals });
      rendererRef.current = renderer;

      renderer.renderFrame(startFrame);
      setStatus(`Stage ${node.id} en curso...`);

      let frameIdx = 0;
      let elapsed = 0;

      const finish = (battleResult: "win" | "loss" | "timeout") => {
        setResult(battleResult);
        setBattlePhase("ending");
        if (battleResult === "win") {
          persistWinProgress(graph, node.id);
          setConfetti(makeConfetti(battleSeed));
        }
        setStatus(`Result: ${battleResult}`);
        endTimer = window.setTimeout(() => setBattlePhase("ended"), 650);
      };

      const tick = () => {
        if (!rendererRef.current) return;
        const deltaMs = app.ticker.deltaMS * speedRef.current;
        elapsed += deltaMs;
        while (frameIdx < frames.length - 1 && elapsed >= frames[frameIdx + 1].timestamp) {
          frameIdx += 1;
          rendererRef.current.renderFrame(frames[frameIdx]);
        }
        rendererRef.current.update(deltaMs);
        if (frameIdx >= frames.length - 1 && !endedRef.current) {
          endedRef.current = true;
          finish(timeline.summary.result);
          app.ticker.remove(tick);
        }
      };

      app.ticker.add(tick);
    };

    setup();

    return () => {
      disposed = true;
      if (endTimer) window.clearTimeout(endTimer);
      rendererRef.current?.destroy();
      rendererRef.current = null;
      if (mount) {
        mount.innerHTML = "";
      }
      if (appRef.current) {
        try {
          appRef.current.destroy(true);
        } catch {
          // ignore
        }
        appRef.current = null;
      }
    };
  }, [graph, graphSeed, resolvedNodeId, querySeed, battleKey]);

  const showOverlay = result !== null && battlePhase !== "running";
  const controlsDisabled = battlePhase !== "running";

  const handleRetry = () => {
    setBattlePhase("idle");
    setResult(null);
    setBattleKey((k) => k + 1);
  };

  const handleBackToMap = () => {
    if (result === "win" && selectedNode) {
      persistWinProgress(graph, selectedNode.id);
    }
    const targetId = selectedNode?.id ?? graph.startNodeId;
    router.push(`/afk/map?nodeId=${encodeURIComponent(targetId)}`);
  };

  const handleNextStage = () => {
    const currentId = selectedNode?.id ?? resolvedNodeId;
    const nextId = currentId ? nextNodeId(graph, currentId) : null;
    if (!nextId) return;
    router.push(`/afk/battle?nodeId=${encodeURIComponent(nextId)}&seed=${querySeed ?? graphSeed}`);
    setBattleKey((k) => k + 1);
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <p className={styles.kicker}>AFK Vertical Slice</p>
          <h1 className={styles.title}>Battle Renderer (Pixi)</h1>
          <p className={styles.subtle}>
            Combate 5v5 generado proceduralmente. El renderer solo consume snapshots y eventos del engine.
          </p>
          <p className={styles.subtle}>Stage: {selectedNode?.id ?? resolvedNodeId}</p>
        </div>
        <div className={styles.controls}>
          <button onClick={() => setSpeed((s) => (s === 1 ? 2 : 1))} disabled={controlsDisabled}>
            Velocidad x{speed}
          </button>
          <button onClick={handleNextStage} disabled={controlsDisabled}>
            Next stage
          </button>
        </div>
      </div>

      <div className={styles.canvasShell}>
        <div ref={mountRef} className={styles.canvas} />
        <div className={styles.overlay}>
          <div>
            <p className={styles.status}>Stage {selectedNode?.id ?? resolvedNodeId}</p>
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

        <div
          className={`${styles.endOverlay} ${showOverlay ? styles.showEnd : ""} ${
            result === "loss" ? styles.lossState : styles.winState
          }`}
        >
          {showOverlay && <div className={styles.dim} />}
          {showOverlay && result === "loss" && <div className={styles.vignette} />}
          {showOverlay && (
            <div
              className={`${styles.resultCard} ${
                battlePhase === "ending" ? styles.pop : styles.stable
              } ${result === "loss" ? styles.shake : ""}`}
            >
              <p className={styles.resultTitle}>{result?.toUpperCase()}</p>
              <p className={styles.resultSubtitle}>{result === "win" ? "Victoria" : result === "loss" ? "Derrota" : "Timeout"}</p>
              <div className={styles.resultButtons}>
                <button className={styles.buttonGhost} onClick={handleRetry}>
                  Reintentar
                </button>
                <button className={styles.buttonPrimary} onClick={handleBackToMap}>
                  Volver al mapa
                </button>
              </div>
            </div>
          )}
          {showOverlay && result === "win" && (
            <div className={styles.confettiLayer}>
              {confetti.map((piece) => (
                <span
                  key={piece.id}
                  className={styles.confetti}
                  style={{
                    left: piece.left,
                    animationDuration: `${piece.duration}ms`,
                    animationDelay: `${piece.delay}ms`,
                    backgroundColor: piece.color,
                    transform: `rotate(${piece.rotation}deg)`,
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <p className={styles.hint}>
        Usa “Next stage” para pasar al siguiente nodo del mapa. El toggle x1/x2 solo acelera el tick del driver.
      </p>

      {process.env.NODE_ENV !== "production" && powerTotals && (
        <div className={styles.debugBar}>
          <span>Ally power (hp+atk): {Math.round(powerTotals.allies)}</span>
          <span>Enemy power (hp+atk): {Math.round(powerTotals.enemies)}</span>
        </div>
      )}
    </div>
  );
}
