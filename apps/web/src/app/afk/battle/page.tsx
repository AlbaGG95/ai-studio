import { Suspense } from "react";
import type { Metadata } from "next";

import { BattleCanvasClient } from "./BattleCanvasClient";
import styles from "./battle.module.css";

export const metadata: Metadata = {
  title: "AFK Battle (Phaser)",
};

export default function AfkBattlePage() {
  return (
    <div className={styles.page}>
      <Suspense fallback={<div className={styles.page}>Cargando batalla...</div>}>
        <BattleCanvasClient />
      </Suspense>
    </div>
  );
}
