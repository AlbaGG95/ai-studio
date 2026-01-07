"use client";

import styles from "../afk.module.css";
import type { LastBattleSummary } from "@/lib/afkStore";

type Props = {
  summary: LastBattleSummary;
  onClose: () => void;
};

function format(num: number | undefined) {
  if (num === undefined) return "0";
  return num.toLocaleString("es-ES");
}

export function StageClearToast({ summary, onClose }: Props) {
  const hasDelta = summary.delta.gold > 0 || summary.delta.exp > 0 || summary.delta.materials > 0;
  return (
    <div className={styles.toastOverlay}>
      <div className={styles.toastCard}>
        <div className={styles.row} style={{ alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <p className={styles.kicker}>Stage cleared</p>
            <h3 className={styles.title} style={{ marginBottom: 4 }}>
              Idle income increased
            </h3>
            <p className={styles.mutedSmall}>Stage {summary.stageId}</p>
          </div>
          <button className={styles.buttonGhost} onClick={onClose} style={{ padding: "6px 10px", fontSize: 12 }}>
            Cerrar
          </button>
        </div>
        <div className={styles.row} style={{ marginTop: 10, gap: 12, flexWrap: "wrap" }}>
          <DeltaPill label="Oro/min" value={summary.delta.gold} next={summary.next.gold} hasDelta={hasDelta} />
          <DeltaPill label="EXP/min" value={summary.delta.exp} next={summary.next.exp} hasDelta={hasDelta} />
          <DeltaPill label="Mats/min" value={summary.delta.materials} next={summary.next.materials} hasDelta={hasDelta} />
        </div>
      </div>
    </div>
  );
}

function DeltaPill({ label, value, next, hasDelta }: { label: string; value: number; next: number; hasDelta: boolean }) {
  const positive = value > 0;
  return (
    <div
      className={styles.pill}
      style={{
        background: "linear-gradient(90deg, rgba(59,130,246,0.14), rgba(16,185,129,0.16))",
        border: "1px solid rgba(148, 163, 184, 0.2)",
        boxShadow: hasDelta && positive ? "0 0 14px rgba(74,222,128,0.2)" : "none",
      }}
    >
      <p className={styles.mutedSmall}>{label}</p>
      <strong style={{ color: positive ? "#4ade80" : "#e2e8f0", fontSize: 14 }}>
        {positive ? "↑ " : ""}{format(value)} {positive ? " (+)" : ""}
      </strong>
      <p className={styles.mutedSmall}>Ahora: {format(next)}</p>
    </div>
  );
}
