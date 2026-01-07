"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import GameCanvas, { type SceneFactory } from "@/game/renderer/GameCanvas";
import { createBattleScene } from "@/game/renderer/scenes/BattleScene";
import { useAfk } from "@/lib/afkStore";
import styles from "./battle.module.css";

export function BattleCanvasClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { state, stages, completeBattle } = useAfk();
  const stageIdParam = searchParams.get("stageId") ?? undefined;
  const fallbackStageId =
    stageIdParam ?? stages.find((s) => s.id === state?.campaign.currentStageId)?.id ?? stages[0]?.id ?? "1-1";
  const sceneFactory: SceneFactory = useMemo(
    () =>
      (Phaser) =>
        createBattleScene(Phaser, {
          stageId: fallbackStageId,
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
    [completeBattle, fallbackStageId, router]
  );

  return (
    <>
      <header className={styles.header}>
        <div>
          <p className={styles.kicker}>Battle Renderer</p>
          <h1 className={styles.title}>5v5 combat replay</h1>
          <p className={styles.subtle}>Renderer pasivo: consume snapshot y eventos reales del motor.</p>
        </div>
        <div className={styles.actions}>
          <Link className={styles.ghost} href="/afk/renderer">
            Volver al hub
          </Link>
        </div>
      </header>

      <div className={styles.canvasShell}>
        <div className={styles.canvasFrame}>
          <GameCanvas sceneFactory={sceneFactory} backgroundColor="#050911" />
        </div>
      </div>

      <p className={styles.hint}>
        Abre /afk/battle en mobile o desktop. Usa Speed/Auto/Back dentro del canvas; la UI se adapta al resize.
      </p>
    </>
  );
}
