"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";

import GameCanvas, { type SceneFactory } from "@/game/renderer/GameCanvas";
import { createMapScene } from "@/game/renderer/scenes/MapScene";
import { buildCampaignViewModel } from "@/game/campaign/campaignViewModel";
import { useAfk } from "@/lib/afkStore";
import styles from "./map.module.css";

export function MapCanvasClient() {
  const router = useRouter();
  const { state, stages, loading, setCurrentStage } = useAfk();
  const campaign = useMemo(() => buildCampaignViewModel(state, stages), [state, stages]);
  const sceneFactory: SceneFactory = useMemo(
    () =>
      (Phaser) =>
        createMapScene(Phaser, {
          campaign,
          onBattle: (stageId) => {
            if (stageId) {
              setCurrentStage(stageId);
              router.push(`/afk/battle?stageId=${stageId}`);
            } else {
              router.push("/afk/battle");
            }
          },
        }),
    [campaign, router, setCurrentStage]
  );

  if (loading || !state || !campaign) {
    return (
      <div className={styles.page}>
        <header className={styles.header}>
          <div>
            <p className={styles.kicker}>Campaign Map</p>
            <h1 className={styles.title}>Living map</h1>
            <p className={styles.subtle}>Cargando progreso...</p>
          </div>
        </header>
        <div className={styles.canvasShell}>
          <div className={styles.canvasFrame} style={{ alignItems: "center", justifyContent: "center" }}>
            <p className={styles.subtle}>Cargando mapa...</p>
          </div>
        </div>
      </div>
    );
  }

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

      <p className={styles.hint}>
        {loading ? "Cargando mapa..." : "Drag to pan the map. Current node pulses; locked nodes are dim."}
      </p>
    </div>
  );
}
