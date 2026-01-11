"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import CampaignMapCanvas from "@/game/renderer/CampaignMapCanvas";
import { createCampaignMapScene } from "@/game/renderer/scenes/CampaignMapScene";
import type { SceneFactory } from "@/game/renderer/GameCanvas";
import { buildCampaignViewModel } from "@/game/campaign/campaignViewModel";
import { useAfk } from "@/lib/afkStore";
import { StageBottomSheet } from "./StageBottomSheet";
import styles from "./map.module.css";

export function MapCanvasClient() {
  const router = useRouter();
  const { state, stages, loading, setCurrentStage } = useAfk();
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null);
  const campaign = useMemo(() => buildCampaignViewModel(state, stages), [state, stages]);
  const stageStateMap = useMemo(
    () => new Map(campaign?.stages.map((s) => [s.id, s.state]) ?? []),
    [campaign?.stages]
  );
  const selectedStage = useMemo(() => stages.find((s) => s.id === selectedStageId) ?? null, [selectedStageId, stages]);

  const sceneFactory: SceneFactory = useMemo(
    () =>
      (Phaser) =>
        createCampaignMapScene(Phaser, {
          stages:
            campaign?.stages.map((s) => ({
              id: s.id,
              state: s.state,
              recommendedPower: s.recommendedPower,
            })) ?? [],
          currentStageId: campaign?.currentStageId,
          onSelectStage: (stageId) => {
            setSelectedStageId(stageId);
          },
        }),
    [campaign]
  );

  const closeSheet = () => setSelectedStageId(null);
  const fight = () => {
    if (!selectedStageId) return;
    setCurrentStage(selectedStageId);
    router.push(`/afk/battle?stageId=${selectedStageId}`);
  };

  if (loading || !state || !campaign) {
    return (
      <div className={styles.mapScreen}>
        <div className={styles.canvasWrap}>
          <div className={styles.canvasFrame} style={{ alignItems: "center", justifyContent: "center" }}>
            <p className={styles.subtle}>Cargando mapa...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.mapScreen}>
      <div className={styles.canvasWrap}>
        <CampaignMapCanvas sceneFactory={sceneFactory} backgroundColor="#0b1224" />
      </div>
      <StageBottomSheet
        stage={selectedStage}
        stateLabel={selectedStageId ? stageStateMap.get(selectedStageId) ?? null : null}
        open={!!selectedStageId}
        onClose={closeSheet}
        onFight={fight}
      />
    </div>
  );
}
