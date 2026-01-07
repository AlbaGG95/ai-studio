"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";

import GameCanvas, { type SceneFactory } from "@/game/renderer/GameCanvas";
import { createMapScene } from "@/game/renderer/scenes/MapScene";
import styles from "./map.module.css";

export function MapCanvasClient() {
  const router = useRouter();
  const sceneFactory: SceneFactory = useMemo(
    () => (Phaser) => createMapScene(Phaser, { onBattle: () => router.push("/afk/battle") }),
    [router]
  );

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.kicker}>Campaign Map</p>
          <h1 className={styles.title}>Living map</h1>
          <p className={styles.subtle}>Tap the current node to enter battle.</p>
        </div>
      </header>

      <div className={styles.canvasShell}>
        <div className={styles.canvasFrame}>
          <GameCanvas sceneFactory={sceneFactory} backgroundColor="#0b1224" />
        </div>
      </div>

      <p className={styles.hint}>Drag to pan the map. Current node pulses; locked nodes are dim.</p>
    </div>
  );
}
