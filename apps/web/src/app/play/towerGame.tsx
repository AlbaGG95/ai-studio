"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./play.module.css";
import {
  TowerDefenseState,
  TowerConfig,
  createTowerDefenseState,
  placeTower,
  startTowerWave,
  stepTower,
  DEFAULT_TD_CONFIG,
} from "@ai-studio/core";

type TowerProps = {
  title?: string;
  config?: Partial<TowerConfig>;
};

export function TowerGame({ title, config }: TowerProps) {
  const merged: TowerConfig = useMemo(() => ({ ...DEFAULT_TD_CONFIG, ...config }), [config]);
  const [state, setState] = useState<TowerDefenseState>(() => createTowerDefenseState(merged));
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setState((s) => stepTower(s, 200));
    }, 200);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const handlePlace = (row: number, col: number) => {
    setState((s) => placeTower(s, row, col));
  };

  const startWave = () => {
    setState((s) => startTowerWave(s));
  };

  const restart = () => {
    setState(createTowerDefenseState(merged));
  };

  return (
    <div className={styles.card}>
      <div className={styles.panelHeader}>
        <div>
          <p className={styles.kicker}>Tower Defense</p>
          <h2 className={styles.title}>{title || "Defense Basic"}</h2>
          <p className={styles.subtle}>Click en celdas para colocar torres. Inicia oleada.</p>
          <p className={styles.subtle}>Base HP: {state.baseHealth} · Oleada: {state.wave}</p>
        </div>
        <div className={styles.actions}>
          <button onClick={startWave} disabled={state.running || state.defeated || state.victory}>
            {state.wave === 0 ? "Iniciar" : "Siguiente oleada"}
          </button>
          <button onClick={restart}>Restart</button>
        </div>
      </div>

      {state.victory && <p className={styles.status}>Victoria</p>}
      {state.defeated && <p className={styles.error}>Derrota</p>}

      <div className={styles.heroGrid} style={{ gridTemplateColumns: `repeat(${merged.cols}, 1fr)` }}>
        {Array.from({ length: merged.rows * merged.cols }).map((_, idx) => {
          const row = Math.floor(idx / merged.cols);
          const col = idx % merged.cols;
          const hasTower = state.towers.some((t) => t.row === row && t.col === col);
          const isPath = row === merged.pathRow;
          const enemyHere = state.enemies.find((e) => Math.floor(e.x) === col && e.row === row);
          return (
            <button
              key={`${row}-${col}`}
              onClick={() => handlePlace(row, col)}
              className={styles.stageNode}
              style={{
                height: 60,
                background: hasTower ? "#243b5a" : isPath ? "#1a263a" : "#0f172a",
                borderColor: enemyHere ? "#ff6b6b" : "#1f2b46",
              }}
            >
              {hasTower ? "T" : isPath ? "" : ""}
              {enemyHere && <span style={{ color: "#ff6b6b", display: "block" }}>E</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
