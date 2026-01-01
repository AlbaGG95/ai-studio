"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AfkCombatEvent, AfkCombatSummary, buildAfkHeroVisual } from "@ai-studio/core";
import styles from "../afk.module.css";
import { HeroPortrait } from "../components/HeroPortrait";
import { PhaserBattle, RenderUnit } from "../components/PhaserBattle";
import { BattleSession, useAfk } from "@/lib/afkStore";

function format(num: number | undefined) {
  if (num === undefined) return "0";
  return num.toLocaleString("es-ES");
}

function buildUnits(session: BattleSession, visuals: Record<string, any>): RenderUnit[] {
  const allyUnits =
    session.summary.allies?.map((unit, idx) => ({
      id: unit.heroId,
      name: unit.name,
      team: "ally" as const,
      slot: idx,
      hp: unit.maxHp,
      maxHp: unit.maxHp,
      energy: 0,
      visual: visuals[unit.heroId] ?? buildAfkHeroVisual(unit.heroId),
    })) ?? [];
  const enemyUnits =
    session.summary.enemies?.map((unit, idx) => ({
      id: unit.heroId,
      name: unit.name,
      team: "enemy" as const,
      slot: idx,
      hp: unit.maxHp,
      maxHp: unit.maxHp,
      energy: 0,
      visual: buildAfkHeroVisual(unit.heroId),
    })) ?? [];
  return [...allyUnits, ...enemyUnits];
}

function applyEvent(units: RenderUnit[], ev: AfkCombatEvent): RenderUnit[] {
  return units.map((unit) => {
    let next = { ...unit };
    if (ev.sourceId === unit.id) {
      next.energy = ev.kind === "ultimate" ? 0 : Math.min(100, unit.energy + 22);
    }
    if (ev.targetId === unit.id) {
      if (ev.kind === "heal") {
        next.hp = Math.min(unit.maxHp, unit.hp + ev.amount);
      } else {
        next.hp = Math.max(0, unit.hp - ev.amount);
        if (next.hp <= 0) {
          next.energy = 0;
        }
      }
    }
    return next;
  });
}

export default function BattlePage() {
  const { state, heroVisuals, startBattle, completeBattle } = useAfk();
  const params = useSearchParams();
  const router = useRouter();
  const [session, setSession] = useState<BattleSession | null>(null);
  const [units, setUnits] = useState<RenderUnit[]>([]);
  const [eventIndex, setEventIndex] = useState(0);
  const [running, setRunning] = useState(true);
  const [lastEvent, setLastEvent] = useState<AfkCombatEvent | null>(null);
  const [speed, setSpeed] = useState(1);
  const [result, setResult] = useState<AfkCombatSummary | null>(null);

  const stageId = useMemo(
    () => params?.get("stageId") ?? state?.campaign.currentStageId ?? "1-1",
    [params, state?.campaign.currentStageId]
  );

  useEffect(() => {
    if (!state) return;
    const fresh = startBattle(stageId);
    if (fresh) {
      setSession(fresh);
      setUnits(buildUnits(fresh, heroVisuals));
      setEventIndex(0);
      setRunning(true);
      setResult(null);
    }
  }, [startBattle, state, stageId, heroVisuals]);

  useEffect(() => {
    if (!session || !running) {
      return;
    }
    const events = session.summary.events;
    if (eventIndex >= events.length) {
      if (!result) {
        setResult(session.summary);
        completeBattle(session.stage.id, session.summary);
      }
      setRunning(false);
      return;
    }
    const batch = speed >= 2 ? 6 : 3;
    const delay = Math.max(80, Math.round(240 / speed));
    const timer = setTimeout(() => {
      setUnits((prev) => {
        let nextUnits = prev;
        const slice = events.slice(eventIndex, eventIndex + batch);
        slice.forEach((ev) => {
          nextUnits = applyEvent(nextUnits, ev);
        });
        if (slice.length) {
          setLastEvent(slice[slice.length - 1]);
        }
        return [...nextUnits];
      });
      setEventIndex((i) => i + batch);
    }, delay);
    return () => clearTimeout(timer);
  }, [session, running, eventIndex, speed, completeBattle, result]);

  if (!state || !session) {
    return (
      <div className={styles.card}>
        <p className={styles.muted}>Cargando batalla...</p>
      </div>
    );
  }

  const allies = units.filter((u) => u.team === "ally");

  const retry = () => {
    const fresh = startBattle(stageId);
    if (fresh) {
      setSession(fresh);
      setUnits(buildUnits(fresh, heroVisuals));
      setEventIndex(0);
      setRunning(true);
      setResult(null);
    }
  };

  return (
    <div className={styles.battleShell}>
      <div className={styles.card}>
        <div className={styles.header}>
          <div>
            <p className={styles.kicker}>Stage {session.stage.id}</p>
            <h1 className={styles.title}>5v5 auto-battle</h1>
            <p className={styles.muted}>
              Poder enemigo {format(session.stage.enemyPower)} · Recompensa {format(session.stage.reward.gold)} oro /{" "}
              {format(session.stage.reward.exp)} exp / {format(session.stage.reward.materials)} mats
            </p>
          </div>
          <div className={styles.actions}>
            <button className={styles.buttonGhost} onClick={() => setRunning((v) => !v)}>
              Auto {running ? "ON" : "OFF"}
            </button>
            <button className={styles.buttonPrimary} onClick={() => setSpeed((s) => (s === 1 ? 2 : 1))}>
              Velocidad x{speed}
            </button>
          </div>
        </div>
        <div className={styles.battleBoard}>
          <PhaserBattle units={units} lastEvent={lastEvent} speed={speed} height={480} />
          <div className={styles.bottomHud}>
            {allies.map((unit) => (
              <div key={unit.id} className={styles.portraitCard}>
                <HeroPortrait visual={unit.visual} seed={unit.id} />
                <div className={styles.portraitBars}>
                  <div className={styles.hpRow}>
                    <span className={styles.muted}>{unit.name}</span>
                    <span className={styles.tag}>
                      {format(Math.round(unit.hp))}/{format(unit.maxHp)}
                    </span>
                  </div>
                  <div className={styles.progressBar}>
                    <div
                      className={styles.progressFill}
                      style={{ width: `${Math.max(0, (unit.hp / unit.maxHp) * 100)}%` }}
                    />
                  </div>
                  <div className={styles.progressBar} style={{ marginTop: 4, background: "#0f172a" }}>
                    <div
                      className={`${styles.energyFill} ${unit.energy >= 95 ? styles.ultReady : ""}`}
                      style={{ width: `${Math.min(100, unit.energy)}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        {result && (
          <div className={styles.battleOverlay}>
            <p className={styles.sectionTitle}>
              {result.result === "win" ? "Victoria" : result.result === "timeout" ? "Tiempo agotado" : "Derrota"}
            </p>
            <p className={styles.muted}>
              Turnos {result.turns} · Daño {format(result.damageDealt)} · Recibido {format(result.damageTaken)}
            </p>
            {result.result === "win" && (
              <p className={styles.muted}>
                  Recompensas: +{format(session.stage.reward.gold)} oro / +{format(session.stage.reward.exp)} exp / +
                  {format(session.stage.reward.materials)} mats
                </p>
              )}
              <div className={styles.actions}>
                <Link href="/afk" className={styles.buttonPrimary}>
                  Continuar
                </Link>
                <button className={styles.buttonGhost} onClick={retry}>
                  Reintentar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
