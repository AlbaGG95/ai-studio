"use client";

import Link from "next/link";

import GameCanvas from "@/game/renderer/GameCanvas";
import { createBattleScene } from "@/game/renderer/scenes/BattleScene";
import styles from "./battle.module.css";

export function BattleCanvasClient() {
  return (
    <>
      <header className={styles.header}>
        <div>
          <p className={styles.kicker}>Battle Renderer</p>
          <h1 className={styles.title}>5v5 mock layout</h1>
          <p className={styles.subtle}>
            Placeholder escena Phaser con HUD y unidades ficticias. No conectada al engine.
          </p>
        </div>
        <div className={styles.actions}>
          <Link className={styles.ghost} href="/afk/renderer">
            Volver al hub
          </Link>
        </div>
      </header>

      <div className={styles.canvasShell}>
        <div className={styles.canvasFrame}>
          <GameCanvas sceneFactory={createBattleScene} backgroundColor="#050911" />
        </div>
      </div>

      <p className={styles.hint}>
        Abre /afk/battle en mobile o desktop. Usa los botones Speed/Auto/Back dentro del canvas; la UI se adapta al resize.
      </p>
    </>
  );
}
