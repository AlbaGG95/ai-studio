import type { Metadata } from "next";
import GameCanvas from "@/game/renderer/GameCanvas";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Renderer | AFK",
};

export default function RendererPage() {
  return (
    <div className={styles.wrap}>
      <header className={styles.header}>
        <div>
          <p className={styles.kicker}>Renderer</p>
          <h1 className={styles.title}>Phaser smoke test</h1>
        </div>
        <span className={styles.pill}>Canvas fit + scale</span>
      </header>

      <div className={styles.canvasShell}>
        <div className={styles.canvasFrame}>
          <GameCanvas />
        </div>
      </div>

      <p className={styles.hint}>Abre en mobile o desktop; el canvas se adapta al contenedor.</p>
    </div>
  );
}
