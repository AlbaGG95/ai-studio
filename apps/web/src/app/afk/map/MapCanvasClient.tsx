"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";

import GameCanvas, { type SceneFactory } from "@/game/renderer/GameCanvas";
import { createMapScene } from "@/game/renderer/scenes/MapScene";
import { buildCampaignViewModel } from "@/game/campaign/campaignViewModel";
import { getTeamPower, useAfk } from "@/lib/afkStore";
import styles from "./map.module.css";

export function MapCanvasClient() {
  const router = useRouter();
  const { state, stages, loading, setCurrentStage } = useAfk();
  const campaign = useMemo(() => buildCampaignViewModel(state, stages), [state, stages]);
  const teamPower = useMemo(() => getTeamPower(state), [state]);
  const sceneFactory: SceneFactory = useMemo(
    () =>
      (Phaser) =>
        createMapScene(Phaser, {
          campaign,
          teamPower,
          onBattle: (stageId) => {
            if (stageId) {
              setCurrentStage(stageId);
              router.push(`/afk/battle?stageId=${stageId}`);
            } else {
              router.push("/afk/battle");
            }
          },
        }),
    [campaign, router, setCurrentStage, teamPower]
  );

  if (loading || !state || !campaign) {
    return (
      <div className={styles.page}>
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
      <div className={styles.canvasShell}>
        <div className={styles.canvasFrame}>
          <GameCanvas sceneFactory={sceneFactory} backgroundColor="#0b1224" />
        </div>
      </div>
    </div>
  );
}
