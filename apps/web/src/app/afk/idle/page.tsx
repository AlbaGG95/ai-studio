"use client";

import { useEffect, useState } from "react";
import styles from "../afk.module.css";
import { ProceduralIcon } from "../components/ProceduralIcon";
import { generateIcon } from "@/lib/afkProcedural";
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
      <div className={`${styles.card} ${styles.heroBanner}`}>
        <div>
          <p className={styles.kicker}>Idle Rewards</p>
          <h1 className={styles.title}>Botín offline listo</h1>
          <p className={styles.muted}>
            Cap de acumulación 8h · progreso {capPct}%. Reclama para transferir el banco a tus recursos y seguir generando.
          </p>
          <div className={styles.progressBar} style={{ marginTop: 12 }}>
            <div className={styles.progressFill} style={{ width: `${capPct}%` }} />
          </div>
          <div className={styles.actions} style={{ marginTop: 12 }}>
            <button className={styles.buttonPrimary} onClick={claimIdle}>
              Reclamar
            </button>
          </div>
          <p className={styles.mutedSmall} style={{ marginTop: 6 }}>
            Último claim: {new Date(state.idle.lastClaimAt).toLocaleTimeString()} · Última vista:{" "}
            {new Date(state.idle.lastSeenAt).toLocaleTimeString()}
          </p>
        </div>
        <div className={styles.rewardIcons}>
          <ProceduralIcon icon={generateIcon("idle-gold")} label={`${format(bank.gold)} oro`} />
          <ProceduralIcon icon={generateIcon("idle-exp")} label={`${format(bank.exp)} exp`} />
          <ProceduralIcon icon={generateIcon("idle-mat")} label={`${format(bank.materials)} mats`} />
        </div>
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
