import type { Metadata } from "next";

import { BattleCanvasClient } from "./BattleCanvasClient";
import styles from "./battle.module.css";

export const metadata: Metadata = {
  title: "AFK Battle (Phaser)",
};

export default function AfkBattlePage() {
  return (
    <div className={styles.page}>
      <BattleCanvasClient />
    </div>
  );
}
