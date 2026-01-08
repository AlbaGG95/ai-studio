"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import GameCanvas, { type SceneFactory } from "@/game/renderer/GameCanvas";
import { createBattleScene } from "@/game/renderer/scenes/BattleScene";
import { useAfk } from "@/lib/afkStore";
import styles from "./battle.module.css";
import { useEffect, useState } from "react";
import { getCombatReplay } from "@/game/renderer/adapters/combatAdapter";
import type { BattleRenderInput } from "@/game/renderer/contracts/renderContract";
import { GameScreenShell } from "../components/GameScreenShell";

export function BattleCanvasClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { state, stages, completeBattle } = useAfk();
  const stageIdParam = searchParams.get("stageId") ?? undefined;
  const fallbackStageId =
    stageIdParam ?? stages.find((s) => s.id === state?.campaign.currentStageId)?.id ?? stages[0]?.id ?? "1-1";
  const [renderInput, setRenderInput] = useState<BattleRenderInput | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const replay = await getCombatReplay({ stageId: fallbackStageId });
      if (!mounted || !replay) {
        setRenderInput(null);
        return;
      }
      setRenderInput({
        stageId: replay.snapshot.stageLabel,
        speed: 1,
        seed: Date.now(),
        snapshot: replay.snapshot,
        events: replay.events,
      });
    };
    load();
    return () => {
      mounted = false;
    };
  }, [fallbackStageId]);

  const sceneFactory: SceneFactory = useMemo(
    () =>
      (Phaser) =>
        createBattleScene(Phaser, {
          renderInput: renderInput ?? undefined,
          onBack: () => router.push("/afk/renderer"),
          onContinue: () => router.push("/afk/idle"),
          onBattleEnd: ({ stageId, result }) => {
            completeBattle(stageId, {
              result: result === "victory" ? "win" : "loss",
              turns: 0,
              damageDealt: 0,
              damageTaken: 0,
              events: [],
            });
          },
        }),
    [completeBattle, renderInput, router]
  );

  if (!renderInput) {
    return (
      <GameScreenShell className={styles.page}>
        <div className={styles.canvasShell}>
          <div className={styles.canvasFrame} style={{ alignItems: "center", justifyContent: "center" }}>
            <p className={styles.subtle}>Preparando replay...</p>
          </div>
        </div>
      </GameScreenShell>
    );
  }

  return (
    <GameScreenShell className={styles.page}>
      <div className={styles.canvasShell}>
        <div className={styles.canvasFrame}>
          <GameCanvas sceneFactory={sceneFactory} backgroundColor="#050911" />
        </div>
      </div>
    </GameScreenShell>
  );
}
