import { Suspense } from "react";
import type { Metadata } from "next";

import { BattleCanvasClient } from "./BattleCanvasClient";
import styles from "./battle.module.css";
import { AfkViewport } from "../components/AfkViewport";

export const metadata: Metadata = {
  title: "AFK Battle (Phaser)",
};

export default function AfkBattlePage() {
  return (
    <AfkViewport className={styles.page}>
      <Suspense fallback={<div className={styles.page}>Cargando batalla...</div>}>
        <BattleCanvasClient />
      </Suspense>
    </AfkViewport>
  );
}
