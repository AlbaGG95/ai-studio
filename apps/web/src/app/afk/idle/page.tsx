"use client";

import { useEffect, useState } from "react";
import styles from "../afk.module.css";
import { useAfk } from "@/lib/afkStore";

function format(num: number | undefined) {
  if (num === undefined) return "0";
  return num.toLocaleString("es-ES");
}

export default function IdlePage() {
  const { state, bank, claimIdle } = useAfk();
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (!state) {
    return (
      <div className={styles.card}>
        <p className={styles.muted}>Cargando botín AFK...</p>
      </div>
    );
  }

  const sinceClaimHours = Math.max(0, (now - state.idle.lastClaimAt) / 3600000);
  const cappedHours = Math.min(8, sinceClaimHours);
  const capPct = Math.min(100, Math.round((cappedHours / 8) * 100));

  return (
    <div className={styles.grid}>
      <div className={styles.card}>
        <p className={styles.sectionTitle}>Botín offline</p>
        <p className={styles.cardTitle}>
          {format(bank.gold)} oro · {format(bank.exp)} exp · {format(bank.materials)} mats
        </p>
        <p className={styles.muted}>Cap de acumulación: 8h · Progreso {capPct}%</p>
        <div className={styles.progressBar} style={{ marginTop: 10 }}>
          <div className={styles.progressFill} style={{ width: `${capPct}%` }} />
        </div>
        <div className={styles.actions} style={{ marginTop: 12 }}>
          <button className={styles.buttonPrimary} onClick={claimIdle}>
            Reclamar
          </button>
        </div>
        <p className={styles.muted} style={{ marginTop: 8 }}>
          Último claim: {new Date(state.idle.lastClaimAt).toLocaleTimeString()} · Última vista:{" "}
          {new Date(state.idle.lastSeenAt).toLocaleTimeString()}
        </p>
      </div>
      <div className={styles.card}>
        <p className={styles.sectionTitle}>Tasa por minuto</p>
        <p className={styles.muted}>
          Oro {format(state.idle.ratePerMinute.gold)} / EXP {format(state.idle.ratePerMinute.exp)} / Materiales{" "}
          {format(state.idle.ratePerMinute.materials)}
        </p>
        <p className={styles.muted}>Aumenta al vencer stages y subir upgrades.</p>
      </div>
    </div>
  );
}
