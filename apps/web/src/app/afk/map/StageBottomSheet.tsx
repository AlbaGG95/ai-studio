"use client";

import styles from "./map.module.css";
import type { AfkStage } from "@ai-studio/core";

type StageBottomSheetProps = {
  stage: AfkStage | null;
  stateLabel: string | null;
  open: boolean;
  onClose: () => void;
  onFight: () => void;
};

export function StageBottomSheet({ stage, stateLabel, open, onClose, onFight }: StageBottomSheetProps) {
  if (!open || !stage) return null;

  const rewards = [
    { label: "Oro", value: stage.reward.gold },
    { label: "EXP", value: stage.reward.exp },
    { label: "Mats", value: stage.reward.materials },
  ];

  return (
    <div className={styles.sheetLayer} aria-live="polite">
      <div className={styles.sheetOverlay} onClick={onClose} />
      <div className={styles.sheet} role="dialog" aria-label={`Stage ${stage.id}`}>
        <div className={styles.sheetHandle} />
        <div className={styles.sheetHeader}>
          <div>
            <p className={styles.sheetKicker}>Stage {stage.id}</p>
            <h3 className={styles.sheetTitle}>Desafio de campaña</h3>
            <p className={styles.sheetMeta}>
              Estado: {stateLabel ?? "locked"} · Poder recomendado{" "}
              {stage.recommendedPower?.toLocaleString("es-ES") ?? "-"}
            </p>
          </div>
          <button className={styles.sheetClose} onClick={onClose} aria-label="Cerrar">
            X
          </button>
        </div>
        <div className={styles.sheetBody}>
          <div className={styles.sheetRewards}>
            {rewards.map((reward) => (
              <div key={reward.label} className={styles.rewardCard}>
                <span className={styles.rewardLabel}>{reward.label}</span>
                <strong>+{reward.value.toLocaleString("es-ES")}</strong>
              </div>
            ))}
          </div>
        </div>
        <div className={styles.sheetActions}>
          <button className={styles.sheetGhost} onClick={onClose}>
            Cerrar
          </button>
          <button className={styles.sheetPrimary} onClick={onFight}>
            Luchar
          </button>
        </div>
      </div>
    </div>
  );
}
