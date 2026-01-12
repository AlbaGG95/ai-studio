"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import CampaignMapCanvas from "@/game/renderer/CampaignMapCanvas";
import { createCampaignMapScene } from "@/game/renderer/scenes/CampaignMapScene";
import type { SceneFactory } from "@/game/renderer/GameCanvas";
import { CampaignMapRuntimeBus, type CampaignMapRuntime } from "@/game/renderer/utils/CampaignMapRuntimeBus";
import { buildCampaignViewModel } from "@/game/campaign/campaignViewModel";
import { useAfk } from "@/lib/afkStore";
import { StageBottomSheet } from "./StageBottomSheet";
import styles from "./map.module.css";

export function MapCanvasClient() {
  const router = useRouter();
  const { state, stages, loading, setCurrentStage } = useAfk();
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null);
  const debugMap = useMemo(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage?.getItem("afkDebugMap") === "1";
  }, []);
  const renderCountRef = useRef(0);
  const campaign = useMemo(() => buildCampaignViewModel(state, stages), [state, stages]);
  const stageStateMap = useMemo(
    () => new Map(campaign?.stages.map((s) => [s.id, s.state]) ?? []),
    [campaign?.stages]
  );
  const selectedStage = useMemo(() => stages.find((s) => s.id === selectedStageId) ?? null, [selectedStageId, stages]);
  // No layoutVersion/seed available yet; stage ids define the layout structure.
  const layoutKey = useMemo(() => stages.map((stage) => stage.id).join("|"), [stages]);
  const layoutStages = useMemo(
    () =>
      stages.map((stage) => ({
        id: stage.id,
        recommendedPower: stage.recommendedPower,
      })),
    [layoutKey]
  );
  const runtimeBus = useMemo(() => new CampaignMapRuntimeBus(), []);
  const runtime = useMemo<CampaignMapRuntime | null>(() => {
    if (!campaign) return null;
    const stageStates = Object.fromEntries(campaign.stages.map((stage) => [stage.id, stage.state]));
    return {
      currentStageId: campaign.currentStageId,
      stageStates,
    };
  }, [campaign]);
  const sceneFactoryBuildRef = useRef(0);
  const handleSelectStage = useCallback((stageId: string) => {
    setSelectedStageId(stageId);
  }, []);

  renderCountRef.current += 1;
  if (debugMap) {
    console.debug(
      `[MapCanvasClient] render #${renderCountRef.current} t=${Date.now()} layoutKey=${layoutKey}`
    );
  }

  useEffect(() => {
    if (!runtime) return;
    runtimeBus.emit(runtime);
    if (debugMap) {
      console.debug(`[MapCanvasClient] runtime emit`);
    }
  }, [runtime, runtimeBus, debugMap]);

  const sceneFactory: SceneFactory = useMemo(
    () =>
      (Phaser) => {
        sceneFactoryBuildRef.current += 1;
        if (debugMap) {
          console.debug(
            `[MapCanvasClient] sceneFactory build #${sceneFactoryBuildRef.current} layoutKey=${layoutKey}`
          );
        }
        return createCampaignMapScene(Phaser, {
          layoutStages,
          runtimeBus,
          onSelectStage: handleSelectStage,
        });
      },
    [layoutKey, layoutStages, runtimeBus, handleSelectStage, debugMap]
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
