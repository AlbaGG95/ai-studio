"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import styles from "../afk.module.css";
import { ProceduralIcon } from "../components/ProceduralIcon";
import { generateIcon } from "@/lib/afkProcedural";
import { useAfk } from "@/lib/afkStore";
import { StageClearToast } from "../components/StageClearToast";
import { AfkViewport } from "../components/AfkViewport";

function format(num: number | undefined) {
  if (num === undefined) return "0";
  return num.toLocaleString("es-ES");
}

function formatDuration(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

type AnimatedCounters = { gold: number; exp: number; materials: number };

function useCountUp(target: AnimatedCounters, durationMs: number, triggerKey: string) {
  const [value, setValue] = useState<AnimatedCounters>(target);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const start = performance.now();
    const from = { gold: 0, exp: 0, materials: 0 };

    const step = () => {
      const now = performance.now();
      const t = Math.min(1, (now - start) / durationMs);
      const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      setValue({
        gold: Math.round(from.gold + (target.gold - from.gold) * ease),
        exp: Math.round(from.exp + (target.exp - from.exp) * ease),
        materials: Math.round(from.materials + (target.materials - from.materials) * ease),
      });
      if (t < 1) {
        rafRef.current = requestAnimationFrame(step);
      }
    };

    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [target.gold, target.exp, target.materials, durationMs, triggerKey]);

  return value;
}

export default function IdlePage() {
  const { state, bank, claimIdle, lastBattleSummary, clearLastBattleSummary } = useAfk();
  const [now, setNow] = useState(Date.now());
  const [lastCollected, setLastCollected] = useState<AnimatedCounters | null>(null);
  const [glow, setGlow] = useState(false);
  const [collectKey, setCollectKey] = useState("");
  const [highlightRates, setHighlightRates] = useState(false);
  const [showToast, setShowToast] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!lastBattleSummary) return;
    setShowToast(true);
    setHighlightRates(true);
    setGlow(true);
    const toastTimer = setTimeout(() => {
      setShowToast(false);
      clearLastBattleSummary();
    }, 2600);
    const glowTimer = setTimeout(() => setGlow(false), 1200);
    const highlightTimer = setTimeout(() => setHighlightRates(false), 1500);
    return () => {
      clearTimeout(toastTimer);
      clearTimeout(glowTimer);
      clearTimeout(highlightTimer);
    };
  }, [clearLastBattleSummary, lastBattleSummary]);

  const idleState = state?.idle;
  const sinceClaimMs = Math.max(0, now - (idleState?.lastClaimAt ?? now));
  const capMs = 8 * 3600000;
  const cappedMs = Math.min(capMs, sinceClaimMs);
  const capPct = Math.min(100, Math.round((cappedMs / capMs) * 100));

  const unclaimed: AnimatedCounters = {
    gold: Math.round(bank?.gold ?? 0),
    exp: Math.round(bank?.exp ?? 0),
    materials: Math.round(bank?.materials ?? 0),
  };

  const perMinute = idleState?.ratePerMinute ?? { gold: 0, exp: 0, materials: 0 };
  const projected = useMemo(() => {
    const minutes = Math.floor(cappedMs / 60000);
    return {
      gold: Math.round(perMinute.gold * minutes),
      exp: Math.round(perMinute.exp * minutes),
      materials: Math.round(perMinute.materials * minutes),
    };
  }, [cappedMs, perMinute.exp, perMinute.gold, perMinute.materials]);

  const animatedCollect = useCountUp(lastCollected ?? { gold: 0, exp: 0, materials: 0 }, 900, collectKey);

  const handleCollect = () => {
    if (!state) return;
    if (!unclaimed.gold && !unclaimed.exp && !unclaimed.materials) {
      claimIdle();
      return;
    }
    setLastCollected(unclaimed);
    setCollectKey(`${Date.now()}`);
    setGlow(true);
    claimIdle();
    setTimeout(() => setGlow(false), 900);
  };

  return (
    <AfkViewport>
      <div className={styles.grid}>
        {showToast && lastBattleSummary && (
          <StageClearToast
            summary={lastBattleSummary}
            onClose={() => {
              setShowToast(false);
              clearLastBattleSummary();
            }}
          />
        )}
        <div className={`${styles.card} ${styles.heroBanner}`}>
          <div>
            <p className={styles.kicker}>Idle Rewards</p>
            <h1 className={styles.title}>Boton offline listo</h1>
            <p className={styles.muted}>
              Cap de acumulacion 8h y progreso {capPct}%. Reclama para transferir el banco a tus recursos y seguir
              generando.
            </p>
            <div className={styles.progressBar} style={{ marginTop: 12 }}>
              <div className={styles.progressFill} style={{ width: `${capPct}%` }} />
            </div>
            <div className={styles.actions} style={{ marginTop: 12 }}>
              <button
                className={styles.buttonPrimary}
                onClick={handleCollect}
                style={{
                  boxShadow: glow ? "0 0 18px rgba(100, 239, 188, 0.45)" : "none",
                  transition: "box-shadow 140ms ease-out",
                }}
              >
                Reclamar
              </button>
            </div>
            <p className={styles.mutedSmall} style={{ marginTop: 6 }}>
              Ultimo claim: {idleState ? new Date(idleState.lastClaimAt).toLocaleTimeString() : "-"} y ultima vista: {" "}
              {idleState ? new Date(idleState.lastSeenAt).toLocaleTimeString() : "-"}
            </p>
            {lastCollected && (
              <p className={styles.mutedSmall} style={{ marginTop: 6 }}>
                Recolectado: oro {format(animatedCollect.gold)} / exp {format(animatedCollect.exp)} / mats {format(animatedCollect.materials)}
              </p>
            )}
          </div>
          <div className={styles.rewardIcons}>
            <ProceduralIcon icon={generateIcon("idle-gold")} label={`${format(unclaimed.gold)} oro sin reclamar`} />
            <ProceduralIcon icon={generateIcon("idle-exp")} label={`${format(unclaimed.exp)} exp sin reclamar`} />
            <ProceduralIcon icon={generateIcon("idle-mat")} label={`${format(unclaimed.materials)} mats sin reclamar`} />
          </div>
        </div>

        <div className={styles.card}>
          <p className={styles.sectionTitle}>Tasa por minuto</p>
          <p className={styles.muted}>
            <span
              style={{
                color: highlightRates ? "#bbf7d0" : undefined,
                textShadow: highlightRates ? "0 0 12px rgba(74,222,128,0.4)" : "none",
              }}
            >
              Oro {format(perMinute.gold)} / EXP {format(perMinute.exp)} / Materiales {format(perMinute.materials)}
              {lastBattleSummary &&
              (lastBattleSummary.delta.gold > 0 ||
                lastBattleSummary.delta.exp > 0 ||
                lastBattleSummary.delta.materials > 0)
                ? " *"
                : ""}
            </span>
          </p>
          <p className={styles.muted}>Aumenta al vencer stages y subir upgrades.</p>
          <div className={styles.row} style={{ marginTop: 8, justifyContent: "space-between" }}>
            <span className={styles.tag}>Tiempo offline</span>
            <span className={styles.muted}>{formatDuration(cappedMs)}</span>
          </div>
          <div className={styles.row} style={{ marginTop: 4, justifyContent: "space-between" }}>
            <span className={styles.tag}>Estimado en ventana</span>
            <span className={styles.muted}>
              Oro {format(projected.gold)} / EXP {format(projected.exp)} / Mats {format(projected.materials)}
            </span>
          </div>
        </div>
      </div>
    </AfkViewport>
  );
}
