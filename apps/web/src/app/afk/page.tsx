"use client";

import Link from "next/link";
import styles from "./afk.module.css";
import { useAfk } from "@/lib/afkStore";

function format(num: number | undefined) {
  if (num === undefined) return "0";
  return num.toLocaleString("es-ES");
}

export default function CampaignPage() {
  const { state, stages, loading, setCurrentStage } = useAfk();

  if (loading || !state) {
    return (
      <div className={styles.card}>
        <p className={styles.muted}>Cargando campaña...</p>
      </div>
    );
  }

  const unlocked = new Set(state.campaign.unlockedStageIds);
  const completed = new Set(state.campaign.completedStageIds);
  const currentId = state.campaign.currentStageId;
  const nextStage =
    stages.find((s) => unlocked.has(s.id) && !completed.has(s.id)) ??
    stages.find((s) => unlocked.has(s.id)) ??
    stages[0];

  return (
    <div className={styles.grid}>
      <div className={styles.card}>
        <div className={styles.header}>
          <div>
            <p className={styles.kicker}>Capítulo {stages[0].chapter}</p>
            <h1 className={styles.title}>Mapa de campaña</h1>
            <p className={styles.muted}>
              Progreso {state.campaign.completedStageIds.length}/{stages.length}. Cada victoria desbloquea el siguiente stage y mejora el botín idle.
            </p>
          </div>
          <div className={styles.actions}>
            <Link className={styles.buttonPrimary} href={`/afk/battle?stageId=${nextStage?.id}`}>
              Luchar (stage {nextStage?.id ?? "1-1"})
            </Link>
          </div>
        </div>
      </div>
      <div className={`${styles.card} ${styles.mapCard}`}>
        <p className={styles.sectionTitle}>Stages 1-20</p>
        <div className={styles.stageList}>
          {stages.map((stage) => {
            const isUnlocked = unlocked.has(stage.id);
            const isCompleted = completed.has(stage.id);
            const isCurrent = stage.id === currentId;
            const status = isCompleted ? "Completado" : isUnlocked ? "Disponible" : "Bloqueado";
            return (
              <div
                key={stage.id}
                className={`${styles.stageNode} ${isUnlocked ? styles.unlocked : styles.locked} ${
                  isCurrent ? styles.currentStage : ""
                }`}
              >
                <div className={styles.stageHeader}>
                  <span className={styles.tag}>{stage.id}</span>
                  <span className={styles.muted}>{status}</span>
                </div>
                <p className={styles.cardTitle}>Poder recomendado {format(stage.recommendedPower)}</p>
                <p className={styles.muted}>
                  Recompensa · +{format(stage.reward.gold)} oro / +{format(stage.reward.exp)} exp / +{format(stage.reward.materials)} mats
                </p>
                <div className={styles.actions}>
                  <button
                    className={styles.buttonGhost}
                    disabled={!isUnlocked}
                    onClick={() => setCurrentStage(stage.id)}
                  >
                    Seleccionar
                  </button>
                  <Link
                    href={`/afk/battle?stageId=${stage.id}`}
                    className={`${styles.buttonPrimary} ${!isUnlocked ? styles.disabled : ""}`}
                    aria-disabled={!isUnlocked}
                  >
                    Luchar
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
