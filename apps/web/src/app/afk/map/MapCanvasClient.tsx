"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import GameCanvas, { type SceneFactory } from "@/game/renderer/GameCanvas";
import { createMapScene } from "@/game/renderer/scenes/MapScene";
import { buildCampaignViewModel } from "@/game/campaign/campaignViewModel";
import { getTeamPower, useAfk } from "@/lib/afkStore";
import styles from "./map.module.css";
import { GameScreenShell } from "../components/GameScreenShell";

export function MapCanvasClient() {
  const router = useRouter();
  const { state, stages, loading, setCurrentStage } = useAfk();
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null);
  const campaign = useMemo(() => buildCampaignViewModel(state, stages), [state, stages]);
  const teamPower = useMemo(() => getTeamPower(state), [state]);
  const stageStateMap = useMemo(
    () => new Map(campaign?.stages.map((s) => [s.id, s.state]) ?? []),
    [campaign?.stages]
  );
  const selectedStage = useMemo(() => stages.find((s) => s.id === selectedStageId), [selectedStageId, stages]);

  const sceneFactory: SceneFactory = useMemo(
    () =>
      (Phaser) =>
        createMapScene(Phaser, {
          campaign,
          teamPower,
          onBattle: (stageId) => {
            if (stageId) {
              setCurrentStage(stageId);
              setSelectedStageId(stageId);
            } else {
              router.push("/afk/battle");
            }
          },
        }),
    [campaign, router, setCurrentStage, teamPower]
  );

  const closeSheet = () => setSelectedStageId(null);
  const fight = () => {
    if (!selectedStageId) return;
    setCurrentStage(selectedStageId);
    router.push(`/afk/battle?stageId=${selectedStageId}`);
  };

  if (loading || !state || !campaign) {
    return (
      <GameScreenShell className={styles.page}>
        <div className={styles.canvasShell}>
          <div className={styles.canvasFrame} style={{ alignItems: "center", justifyContent: "center" }}>
            <p className={styles.subtle}>Cargando mapa...</p>
          </div>
        </div>
      </GameScreenShell>
    );
  }

  return (
    <GameScreenShell className={styles.page}>
      <div className={styles.canvasShell}>
        <div className={styles.canvasFrame}>
          <GameCanvas sceneFactory={sceneFactory} backgroundColor="#0b1224" />
        </div>
      </div>

      {selectedStage && (
        <>
          <div className={styles.sheetOverlay} onClick={closeSheet} />
          <div className={styles.sheet} role="dialog" aria-label={`Stage ${selectedStage.id}`}>
            <div className={styles.sheetHandle} />
            <div className={styles.sheetHeader}>
              <div>
                <p className={styles.sheetKicker}>Stage {selectedStage.id}</p>
                <h3 className={styles.sheetTitle}>Recompensas y poder</h3>
              </div>
              <button className={styles.sheetClose} onClick={closeSheet} aria-label="Cerrar">
                ✕
              </button>
            </div>
            <div className={styles.sheetBody}>
              <p className={styles.sheetMeta}>
                Estado: {stageStateMap.get(selectedStage.id) ?? "locked"} · Poder recomendado{" "}
                {selectedStage.recommendedPower?.toLocaleString("es-ES") ?? "-"}
              </p>
              <div className={styles.sheetRewards}>
                <div className={styles.rewardCard}>
                  <span className={styles.rewardLabel}>Oro</span>
                  <strong>+{selectedStage.reward.gold.toLocaleString("es-ES")}</strong>
                </div>
                <div className={styles.rewardCard}>
                  <span className={styles.rewardLabel}>EXP</span>
                  <strong>+{selectedStage.reward.exp.toLocaleString("es-ES")}</strong>
                </div>
                <div className={styles.rewardCard}>
                  <span className={styles.rewardLabel}>Mats</span>
                  <strong>+{selectedStage.reward.materials.toLocaleString("es-ES")}</strong>
                </div>
              </div>
            </div>
            <div className={styles.sheetActions}>
              <button className={styles.sheetGhost} onClick={closeSheet}>
                Cerrar
              </button>
              <button className={styles.sheetPrimary} onClick={fight}>
                Luchar
              </button>
            </div>
          </div>
        </>
      )}
    </GameScreenShell>
  );
}
