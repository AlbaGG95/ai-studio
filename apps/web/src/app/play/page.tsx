"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { EngineCombatState, EngineState, EngineUnitTemplate } from "@ai-studio/core";
import dynamic from "next/dynamic";
import { buildApiUrl } from "@/lib/api";
import styles from "./play.module.css";

const BattleCanvas = dynamic(() => import("./BattleCanvas").then((m) => m.BattleCanvas), { ssr: false });

type CombatLogEntry = {
  tick: number;
  actor: string;
  action: "attack" | "ultimate" | "defeat";
  target?: string;
  value?: number;
};

type View = "map" | "roster" | "battle";
type GameState = "MAP" | "BATTLE_STARTING" | "BATTLE_RUNNING" | "BATTLE_END" | "RETURNING_TO_MAP";

const AUTO_ENTER_DELAY_MS = 1200;
const RETURN_COOLDOWN_MS = 2000;
const MIN_BATTLE_MS = 8000;
const END_SCREEN_MS = 2000;

async function apiCall<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(buildApiUrl(path), {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await res.json();
  if (!res.ok || data?.ok === false) {
    const message = data?.error || data?.message || `Request failed (${res.status})`;
    throw new Error(message);
  }
  return data;
}

export default function PlayPage() {
  const [engineState, setEngineState] = useState<EngineState | null>(null);
  const [view, setView] = useState<View>("map");
  const [gameState, setGameState] = useState<GameState>("MAP");
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<CombatLogEntry[]>([]);
  const [battleResult, setBattleResult] = useState<"victory" | "defeat" | null>(null);
  const [teamSlots, setTeamSlots] = useState<(string | null)[]>([null, null, null, null, null]);

  const logCursor = useRef(0);
  const autoStartTimer = useRef<NodeJS.Timeout | null>(null);
  const battleTimer = useRef<NodeJS.Timeout | null>(null);
  const endTimer = useRef<NodeJS.Timeout | null>(null);
  const cooldownUntil = useRef<number>(0);
  const battleStartedAt = useRef<number>(0);

  const tickMs = engineState?.config.tickMs ?? 400;

  const clearTimers = () => {
    if (autoStartTimer.current) clearTimeout(autoStartTimer.current);
    if (battleTimer.current) clearInterval(battleTimer.current);
    if (endTimer.current) clearTimeout(endTimer.current);
  };

  useEffect(() => {
    loadEngine();
  }, []);

  useEffect(() => {
    if (!engineState) return;
    setTeamSlots((prev) => {
      if (prev.some((slot) => slot !== null)) return prev;
      const active = engineState.player.activeTeam || [];
      const padded = [...active, null, null, null, null, null].slice(0, 5);
      return padded;
    });
  }, [engineState]);

  useEffect(() => {
    if (!engineState) return;
    if (autoStartTimer.current) clearTimeout(autoStartTimer.current);
    const canAuto =
      gameState === "MAP" && view === "map" && Date.now() >= cooldownUntil.current && !loading && !error;
    if (canAuto) {
      autoStartTimer.current = setTimeout(() => startBattle(), AUTO_ENTER_DELAY_MS);
    }
    return () => {
      if (autoStartTimer.current) clearTimeout(autoStartTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engineState, view, gameState, loading, error]);

  useEffect(() => {
    if (!engineState || gameState !== "BATTLE_RUNNING") return;
    if (!battleStartedAt.current) {
      battleStartedAt.current = Date.now();
    }
    setStatus("Simulando combate...");

    const loop = async () => {
      try {
        const data = await apiCall<any>("/api/engine/simulate", {
          method: "POST",
          body: JSON.stringify({ ticks: 1 }),
        });
        const next: EngineState = data.data?.state || data.state || engineState;
        setEngineState(next);
        const combat: EngineCombatState = next.combat;
        const newLog: CombatLogEntry[] = combat.log?.slice(logCursor.current) || [];
        logCursor.current = combat.log?.length ?? logCursor.current;
        if (newLog.length > 0) setLogs(newLog);

        if (!combat.inProgress) {
          const playerAlive = combat.playerTeam?.some((u) => u.alive);
          const enemyAlive = combat.enemyTeam?.some((u) => u.alive);
          const result = playerAlive && !enemyAlive ? "victory" : "defeat";
          const elapsed = Date.now() - battleStartedAt.current;
          const waitMs = Math.max(0, MIN_BATTLE_MS - elapsed);
          if (battleTimer.current) clearInterval(battleTimer.current);
          endTimer.current = setTimeout(() => finishBattle(result), waitMs);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Fallo al simular combate");
      }
    };

    battleTimer.current = setInterval(loop, tickMs);
    loop();

    return () => {
      if (battleTimer.current) clearInterval(battleTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engineState, gameState, tickMs]);

  const loadEngine = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiCall<any>("/api/engine/load");
      setEngineState(data.data?.state || data.state);
      setStatus("Engine listo");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar el engine");
    } finally {
      setLoading(false);
    }
  };

  const startBattle = () => {
    if (!engineState) return;
    if (gameState !== "MAP" || Date.now() < cooldownUntil.current) return;
    clearTimers();
    logCursor.current = engineState.combat?.log?.length ?? 0;
    setLogs([]);
    setBattleResult(null);
    battleStartedAt.current = 0;
    setView("battle");
    setGameState("BATTLE_STARTING");
    setStatus("Preparando combate...");
    setTimeout(() => setGameState("BATTLE_RUNNING"), 150);
  };

  const finishBattle = (result: "victory" | "defeat") => {
    setBattleResult(result);
    setStatus(result === "victory" ? "Victoria" : "Derrota");
    setGameState("BATTLE_END");
    endTimer.current = setTimeout(() => {
      setGameState("RETURNING_TO_MAP");
      setView("map");
      cooldownUntil.current = Date.now() + RETURN_COOLDOWN_MS;
      setBattleResult(null);
      setStatus("Volviendo al mapa");
      setTimeout(() => {
        setStatus(null);
        setGameState("MAP");
      }, 80);
    }, END_SCREEN_MS);
  };

  const claimAfk = async () => {
    try {
      const data = await apiCall<any>("/api/engine/claim-afk", { method: "POST" });
      setEngineState(data.data?.state || data.state);
      setStatus(`AFK +${data.data?.rewards?.gold ?? 0} oro, +${data.data?.rewards?.xp ?? 0} XP`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo reclamar AFK");
    }
  };

  const heroMap = useMemo(() => {
    const map: Record<string, EngineUnitTemplate> = {};
    engineState?.player.heroes.forEach((h) => (map[h.id] = h));
    return map;
  }, [engineState]);

  const stages = useMemo(() => {
    const current = engineState?.player.campaign.currentStage ?? 1;
    const best = engineState?.player.campaign.bestStage ?? current;
    const max = Math.max(current + 2, best + 1, 3);
    return new Array(max).fill(0).map((_, i) => i + 1);
  }, [engineState]);

  const setSlot = (index: number, heroId: string | null) => {
    setTeamSlots((prev) => {
      const next = [...prev];
      next[index] = heroId;
      return next;
    });
  };

  const applyHero = (heroId: string) => {
    const hero = heroMap[heroId];
    if (!hero) return;
    const next = [...teamSlots];
    const availableIndex =
      hero.position === "front"
        ? next.findIndex((id, idx) => idx < 2 && !id)
        : next.findIndex((id, idx) => idx >= 2 && !id);
    if (availableIndex === -1) {
      setStatus("Sin espacio en esa línea");
      return;
    }
    next[availableIndex] = heroId;
    setTeamSlots(next);
  };

  const saveTeam = async () => {
    if (!engineState) return;
    const cleaned = teamSlots.filter((id): id is string => Boolean(id));
    const nextState: EngineState = {
      ...engineState,
      player: { ...engineState.player, activeTeam: cleaned },
    };
    try {
      const data = await apiCall<any>("/api/engine/save", {
        method: "POST",
        body: JSON.stringify({ state: nextState }),
      });
      setEngineState(data.data?.state || data.state);
      setStatus("Equipo guardado");
      setView("map");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el equipo");
    }
  };

  const renderMap = () => (
    <div className={styles.mapPanel}>
      <div className={styles.panelHeader}>
        <div>
          <p className={styles.kicker}>Mapa de campaña</p>
          <h2 className={styles.title}>Capítulo 1</h2>
          <p className={styles.subtle}>Stage actual: {engineState?.player.campaign.currentStage ?? 1}</p>
        </div>
        <div className={styles.actions}>
          <button onClick={() => setView("roster")}>Editar equipo</button>
          <button onClick={claimAfk}>Reclamar AFK</button>
        </div>
      </div>
      <div className={styles.stages}>
        {stages.map((stage) => {
          const current = engineState?.player.campaign.currentStage ?? 1;
          const best = engineState?.player.campaign.bestStage ?? 1;
          const state =
            stage < current ? "done" : stage === current ? "current" : stage <= best + 1 ? "open" : "locked";
          return (
            <button
              key={stage}
              className={`${styles.stageNode} ${styles[state]}`}
              onClick={() => startBattle()}
              disabled={state === "locked" || gameState !== "MAP"}
            >
              <span>{stage}</span>
            </button>
          );
        })}
      </div>
      <p className={styles.muted}>
        Pulsa un nodo (o espera) para entrar al combate. Los stages completados brillan, el actual pulsa.
      </p>
    </div>
  );

  const renderRoster = () => (
    <div className={styles.roster}>
      <div className={styles.panelHeader}>
        <div>
          <p className={styles.kicker}>Formación</p>
          <h2 className={styles.title}>Elige tu equipo (2 front / 3 back)</h2>
        </div>
        <div className={styles.actions}>
          <button
            onClick={() => {
              setView("map");
              setGameState("MAP");
            }}
          >
            Volver al mapa
          </button>
          <button onClick={saveTeam}>Guardar equipo</button>
        </div>
      </div>
      <div className={styles.teamSlots}>
        {teamSlots.map((heroId, idx) => {
          const hero = heroId ? heroMap[heroId] : null;
          const label = idx < 2 ? "Front" : "Back";
          return (
            <div key={idx} className={styles.slotCard}>
              <p className={styles.slotLabel}>{label}</p>
              {hero ? (
                <>
                  <p className={styles.itemTitle}>{hero.name}</p>
                  <p className={styles.subtle}>{hero.role}</p>
                  <button className={styles.link} onClick={() => setSlot(idx, null)}>
                    Vaciar
                  </button>
                </>
              ) : (
                <p className={styles.muted}>Vacío</p>
              )}
            </div>
          );
        })}
      </div>
      <div className={styles.heroGrid}>
        {engineState?.player.heroes.map((hero) => (
          <div key={hero.id} className={`${styles.heroCard} ${styles[hero.rarity]}`}>
            <div className={styles.heroHeader}>
              <p className={styles.itemTitle}>{hero.name}</p>
              <span className={styles.tag}>{hero.rarity}</span>
            </div>
            <p className={styles.subtle}>Rol: {hero.role} · Línea: {hero.position}</p>
            <p className={styles.subtle}>HP {hero.baseStats.hp} · ATK {hero.baseStats.atk}</p>
            <button onClick={() => applyHero(hero.id)}>Añadir</button>
          </div>
        ))}
      </div>
    </div>
  );

  const renderBattle = () => (
    <div className={styles.battleWrap}>
      <div className={styles.panelHeader}>
        <div>
          <p className={styles.kicker}>Stage {engineState?.player.campaign.currentStage}</p>
          <h2 className={styles.title}>Combate automático</h2>
          <p className={styles.subtle}>Mira la batalla, el engine decide el resultado</p>
        </div>
        <div className={styles.actions}>
          <button
            onClick={() => {
              setView("map");
              setGameState("MAP");
            }}
            disabled={gameState === "BATTLE_RUNNING" || gameState === "BATTLE_STARTING"}
          >
            Salir al mapa
          </button>
        </div>
      </div>
      <BattleCanvas combat={engineState?.combat} logs={logs} tickMs={tickMs} />
      {battleResult && <div className={styles.banner}>{battleResult === "victory" ? "Victoria" : "Derrota"}</div>}
      <div className={styles.logBar}>
        <p className={styles.muted}>Última acción: {logs[logs.length - 1]?.action ?? "..."}</p>
        <p className={styles.muted}>
          HP aliados: {engineState?.combat.playerTeam?.filter((u) => u.alive).length ?? 0} · Enemigos:{" "}
          {engineState?.combat.enemyTeam?.filter((u) => u.alive).length ?? 0}
        </p>
      </div>
    </div>
  );

  return (
    <main className={styles.main}>
      <div className={styles.card}>
        <header className={styles.header}>
          <div>
            <p className={styles.kicker}>Idle RPG</p>
            <h1 className={styles.title}>AI Studio Play</h1>
            <p className={styles.subtle}>Todo ocurre en vivo aunque no toques nada</p>
          </div>
          <div className={styles.actions}>
            <button onClick={loadEngine}>Refrescar</button>
            <button onClick={() => setView("map")}>Mapa</button>
            <button onClick={() => setView("roster")}>Roster</button>
            <button onClick={startBattle}>Ver batalla</button>
          </div>
        </header>

        {loading && <p className={styles.status}>Cargando engine...</p>}
        {error && <p className={styles.error}>{error}</p>}
        {status && <p className={styles.status}>{status}</p>}

        {!loading && engineState && (
          <>
            {view === "map" && renderMap()}
            {view === "roster" && renderRoster()}
            {view === "battle" && renderBattle()}
          </>
        )}
      </div>
    </main>
  );
}
