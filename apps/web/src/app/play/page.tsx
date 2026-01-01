"use client";

import Link from "next/link";
import Image from "next/image";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { EngineCombatState, EngineItem, EngineState, EngineUnitTemplate } from "@ai-studio/core";
import dynamic from "next/dynamic";
import { buildApiUrl } from "@/lib/api";
import { buildHeroArtSpec, getPortraitDataUri, HeroArtSpec } from "./heroArt";
import { TriviaGame } from "./triviaGame";
import { RunnerGame } from "./runnerGame";
import { TowerGame } from "./towerGame";
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
type ResultInfo = {
  outcome: "victory" | "defeat";
  gold: number;
  xp: number;
  newItems: EngineItem[];
  stageFrom: number;
  stageTo: number;
};

type ProjectRecord = {
  id: string;
  title?: string;
  description?: string;
  createdAt?: string;
  templateId?: string;
  spec?: { type?: string };
  route?: string;
  config?: any;
  schemaVersion?: number;
};

const AUTO_ENTER_DELAY_MS = 1200;
const RETURN_COOLDOWN_MS = 2000;
const MIN_BATTLE_MS = 8000;
const RESULT_OVERLAY_MS = 2000;
const VIEW_DEBOUNCE_MS = 150;

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

function PlayPageContent() {
  const searchParams = useSearchParams();
  const projectId = useMemo(() => searchParams.get("projectId"), [searchParams]);
  const templateFromQuery = useMemo(() => searchParams.get("templateId") || searchParams.get("template"), [searchParams]);
  const debugMode = useMemo(
    () => process.env.NODE_ENV !== "production" && searchParams.get("debug") === "1",
    [searchParams]
  );
  const [engineState, setEngineState] = useState<EngineState | null>(null);
  const [projectRecord, setProjectRecord] = useState<ProjectRecord | null>(null);
  const [projectError, setProjectError] = useState<string | null>(null);
  const [projectLoading, setProjectLoading] = useState<boolean>(true);
  const [view, setView] = useState<View>("map");
  const [gameState, setGameState] = useState<GameState>("MAP");
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<CombatLogEntry[]>([]);
  const [battleResult, setBattleResult] = useState<"victory" | "defeat" | null>(null);
  const [teamSlots, setTeamSlots] = useState<(string | null)[]>([null, null, null, null, null]);
  const [autoContinue, setAutoContinue] = useState(true);
  const [pendingManualContinue, setPendingManualContinue] = useState(false);
  const [resultInfo, setResultInfo] = useState<ResultInfo | null>(null);
  const [heroArtMap, setHeroArtMap] = useState<Record<string, HeroArtSpec>>({});
  const templateId = projectRecord?.templateId || templateFromQuery || null;
  const isIdleTemplate = templateId === "idle_rpg_afk";
  const runtimeComponent =
    templateId === "idle_rpg_afk"
      ? "AFKEngine"
      : templateId === "trivia_basic"
      ? "TriviaGame"
      : templateId === "runner_endless"
      ? "RunnerGame"
      : templateId === "tower_defense_basic"
      ? "TowerGame"
      : "PlaceholderGame";

  const logCursor = useRef(0);
  const autoStartTimer = useRef<NodeJS.Timeout | null>(null);
  const battleTimer = useRef<NodeJS.Timeout | null>(null);
  const endTimer = useRef<NodeJS.Timeout | null>(null);
  const cooldownUntil = useRef<number>(0);
  const battleStartedAt = useRef<number>(0);
  const preBattleSnapshot = useRef<{
    gold: number;
    xp: number;
    items: number;
    stage: number;
    bestStage: number;
  } | null>(null);
  const transitionGuard = useRef(false);
  const lastViewChangeAt = useRef(0);
  const battleSession = useRef(0);

  const tickMs = engineState?.config.tickMs ?? 400;
  const projectQuery = useMemo(
    () => (projectId ? `?projectId=${encodeURIComponent(projectId)}` : ""),
    [projectId]
  );

  useEffect(() => {
    if (!debugMode) return;
    console.log(
      `[PLAY] projectId=${projectId ?? "?"} type=${projectRecord?.spec?.type ?? "?"} template=${
        templateId ?? "?"
      } runtime=${runtimeComponent}`
    );
  }, [debugMode, projectId, projectRecord?.spec?.type, templateId, runtimeComponent]);

  useEffect(() => {
    setProjectRecord(null);
    setProjectError(null);
    if (!projectId) {
      setProjectLoading(false);
      setLoading(false);
      setProjectError("Falta projectId en la URL. Selecciona un proyecto para jugar.");
      return;
    }
    let cancelled = false;
    const run = async () => {
      await loadProject(projectId, cancelled);
    };
    run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const clearTimers = () => {
    if (autoStartTimer.current) clearTimeout(autoStartTimer.current);
    if (battleTimer.current) clearInterval(battleTimer.current);
    if (endTimer.current) clearTimeout(endTimer.current);
  };

  const guardedViewChange = (next: View, force = false) => {
    const now = Date.now();
    if (!force && transitionGuard.current) return;
    if (!force && now - lastViewChangeAt.current < VIEW_DEBOUNCE_MS) return;
    lastViewChangeAt.current = now;
    setView(next);
  };

  useEffect(() => {
    clearTimers();
    setEngineState(null);
    setLogs([]);
    setBattleResult(null);
    setResultInfo(null);
    setStatus(null);
    setError(null);
    setProjectError(null);
    setGameState("MAP");
    setView("map");
    setPendingManualContinue(false);

    if (!isIdleTemplate) {
      setLoading(false);
      return;
    }

    if (!projectId) {
      setProjectLoading(false);
      setLoading(false);
      setProjectError("Falta projectId en la URL. Selecciona un proyecto para jugar.");
      return;
    }

    let cancelled = false;

    const init = async () => {
      if (!projectRecord) return;
      await loadEngine(projectId);
      if (cancelled) return;
    };

    init();

    return () => {
      cancelled = true;
      clearTimers();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, isIdleTemplate, projectRecord]);

  useEffect(() => {
    if (!engineState) return;
    setTeamSlots((prev) => {
      if (prev.some((slot) => slot !== null)) return prev;
      const active = engineState.player.activeTeam || [];
      const padded = [...active, null, null, null, null, null].slice(0, 5);
      return padded;
    });
    const nextArt: Record<string, HeroArtSpec> = {};
    engineState.player.heroes.forEach((hero) => {
      nextArt[hero.id] = buildHeroArtSpec(hero, projectId || undefined);
    });
    setHeroArtMap(nextArt);
  }, [engineState, projectId]);

  useEffect(() => {
    if (!engineState) return;
    if (autoStartTimer.current) clearTimeout(autoStartTimer.current);
    const remainingCooldown = Math.max(0, cooldownUntil.current - Date.now());
    const canAuto =
      gameState === "MAP" &&
      view === "map" &&
      !loading &&
      !error &&
      !projectError &&
      !projectLoading &&
      autoContinue &&
      !transitionGuard.current;
    if (canAuto) {
      const delay = AUTO_ENTER_DELAY_MS + remainingCooldown;
      autoStartTimer.current = setTimeout(() => startBattle(), delay);
    }
    return () => {
      if (autoStartTimer.current) clearTimeout(autoStartTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engineState, view, gameState, loading, error, projectError, projectLoading, autoContinue]);

  useEffect(() => {
    if (!engineState || gameState !== "BATTLE_RUNNING") return;
    if (!battleStartedAt.current) {
      battleStartedAt.current = Date.now();
    }
    setStatus("Simulando combate...");

    const loop = async () => {
      try {
        const data = await apiCall<any>(`/api/engine/simulate${projectQuery}`, {
          method: "POST",
          body: JSON.stringify({ ticks: 1, projectId }),
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

  const loadProject = async (id: string, cancelled?: boolean) => {
    setProjectLoading(true);
    setProjectError(null);
    setStatus("Cargando proyecto...");
    try {
      const response = await fetch(buildApiUrl(`/api/projects/${encodeURIComponent(id)}`), { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data?.ok === false || !data?.project) {
        throw new Error(data?.error || `No se pudo cargar el proyecto ${id}`);
      }
      if (cancelled) return false;
      setProjectRecord(data.project);
      setProjectError(null);
      setStatus(`Proyecto ${data.project?.title ?? id} listo`);
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo cargar el proyecto.";
      if (!cancelled) {
        setProjectRecord(null);
        setProjectError(message);
        setError(message);
        setStatus(null);
      }
      return false;
    } finally {
      if (!cancelled) {
        setProjectLoading(false);
        setLoading(false);
      }
    }
  };

  const loadEngine = async (id?: string) => {
    setLoading(true);
    setError(null);
    const query = id
      ? `?projectId=${encodeURIComponent(id)}`
      : projectQuery;
    try {
      const data = await apiCall<any>(`/api/engine/load${query}`);
      setEngineState(data.data?.state || data.state);
      setStatus("Engine listo");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar el engine");
      setStatus(null);
    } finally {
      setPendingManualContinue(false);
      setLoading(false);
    }
  };

  const startBattle = () => {
    if (!engineState || projectError || projectLoading) return;
    if (gameState !== "MAP" || Date.now() < cooldownUntil.current) return;
    if (transitionGuard.current) return;
    transitionGuard.current = true;
    battleSession.current += 1;
    const sessionId = battleSession.current;
    clearTimers();
    logCursor.current = engineState.combat?.log?.length ?? 0;
    setLogs([]);
    setBattleResult(null);
    setResultInfo(null);
    setPendingManualContinue(false);
    battleStartedAt.current = 0;
    preBattleSnapshot.current = {
      gold: engineState.player.resources.gold,
      xp: engineState.player.resources.xp,
      items: engineState.player.items.length,
      stage: engineState.player.campaign.currentStage,
      bestStage: engineState.player.campaign.bestStage,
    };
    guardedViewChange("battle", true);
    setGameState("BATTLE_STARTING");
    setStatus("Preparando combate...");
    setTimeout(() => {
      if (battleSession.current !== sessionId) return;
      setGameState("BATTLE_RUNNING");
      transitionGuard.current = false;
    }, 150);
  };

  const returnToMapAfterResult = () => {
    if (endTimer.current) clearTimeout(endTimer.current);
    setGameState("RETURNING_TO_MAP");
    guardedViewChange("map", true);
    cooldownUntil.current = Date.now() + RETURN_COOLDOWN_MS;
    setBattleResult(null);
    setResultInfo(null);
    setStatus("Volviendo al mapa");
    setTimeout(() => {
      setStatus(null);
      setGameState("MAP");
      transitionGuard.current = false;
      setPendingManualContinue(!autoContinue);
    }, 80);
  };

  const finishBattle = (result: "victory" | "defeat") => {
    if (!engineState) return;
    if (gameState === "BATTLE_END" || gameState === "RETURNING_TO_MAP") return;
    transitionGuard.current = true;
    setBattleResult(result);
    setStatus(result === "victory" ? "Victoria" : "Derrota");
    setGameState("BATTLE_END");
    const snapshot = preBattleSnapshot.current;
    const currentResources = engineState.player.resources;
    const goldDelta = Math.max(0, currentResources.gold - (snapshot?.gold ?? currentResources.gold));
    const xpDelta = Math.max(0, currentResources.xp - (snapshot?.xp ?? currentResources.xp));
    const itemsGained =
      (engineState.player.items?.length ?? 0) - (snapshot?.items ?? engineState.player.items?.length ?? 0);
    const newItems =
      itemsGained > 0 ? engineState.player.items.slice(Math.max(0, engineState.player.items.length - itemsGained)) : [];
    const stageFrom = snapshot?.stage ?? engineState.combat.stage ?? 1;
    const stageTo =
      result === "victory"
        ? Math.max(stageFrom + 1, engineState.player.campaign.currentStage)
        : engineState.player.campaign.currentStage ?? stageFrom;

    setResultInfo({
      outcome: result,
      gold: goldDelta,
      xp: xpDelta,
      newItems,
      stageFrom,
      stageTo,
    });

    endTimer.current = setTimeout(returnToMapAfterResult, RESULT_OVERLAY_MS);
  };

  const claimAfk = async () => {
    if (projectError || !engineState) return;
    try {
      const data = await apiCall<any>(`/api/engine/claim-afk${projectQuery}`, {
        method: "POST",
        body: JSON.stringify({ projectId }),
      });
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
    if (!engineState || projectError) return;
    const cleaned = teamSlots.filter((id): id is string => Boolean(id));
    const nextState: EngineState = {
      ...engineState,
      player: { ...engineState.player, activeTeam: cleaned },
    };
    try {
      const data = await apiCall<any>(`/api/engine/save${projectQuery}`, {
        method: "POST",
        body: JSON.stringify({ state: nextState, projectId }),
      });
      setEngineState(data.data?.state || data.state);
      setStatus("Equipo guardado");
      guardedViewChange("map");
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
          <p className={styles.subtle}>
            Proyecto: {projectRecord?.title ?? projectId ?? "sin seleccionar"}
          </p>
          <p className={styles.subtle}>Stage actual: {engineState?.player.campaign.currentStage ?? 1}</p>
        </div>
        <div className={styles.actions}>
          <button onClick={() => guardedViewChange("roster")} disabled={projectLoading || !!projectError}>
            Editar equipo
          </button>
          <button onClick={claimAfk} disabled={projectLoading || !!projectError}>
            Reclamar AFK
          </button>
          {!autoContinue && (
            <button
              onClick={startBattle}
              disabled={
                gameState !== "MAP" || projectLoading || !!projectError || !engineState
              }
            >
              Continuar stage
            </button>
          )}
        </div>
      </div>
      <div className={styles.flowControls}>
        <label className={styles.toggle}>
          <input
            type="checkbox"
            checked={autoContinue}
            onChange={(e) => {
              setAutoContinue(e.target.checked);
              if (e.target.checked) setPendingManualContinue(false);
            }}
          />
          <span className={styles.toggleLabel}>Auto-continue</span>
        </label>
        {!autoContinue && (
          <span className={styles.manualHint}>
            Avanza manualmente tras ver resultados. Pulsa Continuar stage para seguir.
          </span>
        )}
        {pendingManualContinue && !autoContinue && <span className={styles.readyPill}>Listo para continuar</span>}
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
              disabled={
                state === "locked" || gameState !== "MAP" || projectLoading || !!projectError || !engineState
              }
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
              guardedViewChange("map");
              setGameState("MAP");
            }}
          >
            Volver al mapa
          </button>
          <button onClick={saveTeam} disabled={projectLoading || !!projectError}>
            Guardar equipo
          </button>
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
            {heroArtMap[hero.id] && (
              <Image
                src={getPortraitDataUri(heroArtMap[hero.id])}
                alt={hero.name}
                width={320}
                height={240}
                style={{ width: "100%", height: "auto", borderRadius: 12, margin: "8px 0", border: "1px solid #1f2b46" }}
                unoptimized
              />
            )}
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
          <p className={styles.subtle}>
            Proyecto: {projectRecord?.title ?? projectId ?? "sin seleccionar"}
          </p>
        </div>
        <div className={styles.actions}>
          <button
            onClick={() => {
              guardedViewChange("map");
              setGameState("MAP");
            }}
            disabled={
              gameState === "BATTLE_RUNNING" ||
              gameState === "BATTLE_STARTING" ||
              projectLoading ||
              !!projectError
            }
          >
            Salir al mapa
          </button>
        </div>
      </div>
      <BattleCanvas
        combat={engineState?.combat}
        logs={logs}
        tickMs={tickMs}
        heroArt={heroArtMap}
        projectId={projectId ?? undefined}
        seed={engineState?.seed}
      />
      {battleResult && <div className={styles.banner}>{battleResult === "victory" ? "Victoria" : "Derrota"}</div>}
      {resultInfo && gameState !== "BATTLE_RUNNING" && (
        <div
          className={`${styles.resultOverlay} ${
            resultInfo.outcome === "victory" ? styles.victory : styles.defeat
          }`}
        >
          <div className={styles.resultHeader}>
            <p className={styles.kicker}>Resultado</p>
            <h3 className={styles.resultTitle}>
              {resultInfo.outcome === "victory" ? "VICTORIA" : "DERROTA"}
            </h3>
            <p className={styles.subtle}>
              Stage {resultInfo.stageFrom} {resultInfo.outcome === "victory" ? "->" : "(retry)"} {resultInfo.stageTo}
            </p>
          </div>
          <div className={styles.lootRow}>
            <div className={styles.lootItem}>
              <span className={styles.lootLabel}>Oro</span>
              <strong>+{resultInfo.gold}</strong>
            </div>
            <div className={styles.lootItem}>
              <span className={styles.lootLabel}>XP</span>
              <strong>+{resultInfo.xp}</strong>
            </div>
            <div className={styles.lootItem}>
              <span className={styles.lootLabel}>Items</span>
              <strong>{resultInfo.newItems.length > 0 ? resultInfo.newItems[0]?.name : "—"}</strong>
              {resultInfo.newItems.length > 1 && (
                <span className={styles.subtle}>+{resultInfo.newItems.length - 1} extra</span>
              )}
            </div>
          </div>
          {!autoContinue && (
            <div className={styles.resultActions}>
              <button onClick={returnToMapAfterResult}>Continuar al mapa</button>
            </div>
          )}
        </div>
      )}
      <div className={styles.logBar}>
        <p className={styles.muted}>Última acción: {logs[logs.length - 1]?.action ?? "..."}</p>
        <p className={styles.muted}>
          HP aliados: {engineState?.combat.playerTeam?.filter((u) => u.alive).length ?? 0} · Enemigos:{" "}
          {engineState?.combat.enemyTeam?.filter((u) => u.alive).length ?? 0}
        </p>
      </div>
    </div>
  );

  const renderIdleView = () => {
    if (loading) return <p className={styles.status}>Cargando engine...</p>;
    if (!engineState) return <p className={styles.error}>Engine no disponible.</p>;
    return (
      <>
        {view === "map" && renderMap()}
        {view === "roster" && renderRoster()}
        {view === "battle" && renderBattle()}
      </>
    );
  };

  const renderTemplateView = () => {
    if (projectLoading) return <p className={styles.status}>Cargando proyecto...</p>;
    if (projectError) return <p className={styles.error}>{projectError}</p>;
    if (!projectRecord) return <p className={styles.error}>Proyecto no disponible.</p>;
    if (!projectId) {
      return <p className={styles.error}>Falta projectId en la URL. Selecciona un proyecto para jugar.</p>;
    }
    switch (templateId) {
      case "trivia_basic":
        return (
          <TriviaGame
            config={{
              title: projectRecord?.title || searchParams.get("title") || "Trivia",
              questions: projectRecord?.config?.questions || projectRecord?.config?.content?.entities,
            }}
          />
        );
      case "runner_endless":
        return <RunnerGame title={projectRecord?.title || projectId || "Runner"} config={projectRecord?.config} />;
      case "tower_defense_basic":
        return <TowerGame title={projectRecord?.title || projectId || "TD"} config={projectRecord?.config} />;
      case "match3_basic":
      case "clicker_basic":
      case "platformer_basic":
      case "placeholder_basic":
        return <PlaceholderGame title={projectRecord?.title || projectId || "Juego"} templateId={templateId} />;
      case "idle_rpg_afk":
        return renderIdleView();
      default:
        return <PlaceholderGame title={projectRecord?.title || projectId || "Juego"} templateId={templateId} />;
    }
  };

  return (
    <main className={styles.main}>
      <div className={styles.card}>
        {debugMode && (
          <div
            style={{
              position: "fixed",
              top: 12,
              right: 12,
              padding: "10px 12px",
              background: "#0b1020",
              border: "1px solid #1f2b46",
              borderRadius: 8,
              zIndex: 2000,
              minWidth: 200,
              boxShadow: "0 6px 18px rgba(0,0,0,0.35)",
            }}
          >
            <p className={styles.kicker}>Debug</p>
            <p className={styles.subtle}>projectId: {projectId ?? "?"}</p>
            <p className={styles.subtle}>title: {projectRecord?.title ?? "?"}</p>
            <p className={styles.subtle}>spec.type: {projectRecord?.spec?.type ?? "?"}</p>
            <p className={styles.subtle}>templateId: {templateId ?? "?"}</p>
            <p className={styles.subtle}>runtime: {runtimeComponent}</p>
            <p className={styles.subtle}>route: {projectRecord?.route ?? "?"}</p>
            <p className={styles.subtle}>schemaVersion: {projectRecord?.schemaVersion ?? "?"}</p>
            <p className={styles.subtle}>ts: {new Date().toISOString()}</p>
          </div>
        )}
        <header className={styles.header}>
          <div>
            <p className={styles.kicker}>Idle RPG</p>
            <h1 className={styles.title}>AI Studio Play</h1>
            <p className={styles.subtle}>Todo ocurre en vivo aunque no toques nada</p>
            {projectId && (
              <p className={styles.subtle}>
                Proyecto: {projectRecord?.title ?? (projectLoading ? "Cargando..." : "Desconocido")} ({projectId})
              </p>
            )}
          </div>
          <div className={styles.actions}>
            <button onClick={() => loadEngine(projectId ?? undefined)} disabled={projectLoading || !!projectError}>
              Refrescar
            </button>
            <button onClick={() => guardedViewChange("map")} disabled={projectLoading || !!projectError}>
              Mapa
            </button>
            <button onClick={() => guardedViewChange("roster")} disabled={projectLoading || !!projectError || !engineState}>
              Roster
            </button>
            <button onClick={startBattle} disabled={projectLoading || !!projectError || !engineState}>
              Ver batalla
            </button>
          </div>
        </header>

        {projectLoading && <p className={styles.status}>Cargando proyecto...</p>}
        {projectError && (
          <p className={styles.error}>
            {projectError}{" "}
            <Link className={styles.link} href="/projects">
              Volver a proyectos
            </Link>
          </p>
        )}
        {!projectError && (
          <>
            {loading && <p className={styles.status}>Cargando engine...</p>}
            {error && <p className={styles.error}>{error}</p>}
          </>
        )}
        {status && <p className={styles.status}>{status}</p>}

        {renderTemplateView()}
      </div>
    </main>
  );
}

export default function PlayPage() {
  return (
    <Suspense
      fallback={
        <main className={styles.main}>
          <div className={styles.card}>
            <p className={styles.status}>Cargando...</p>
          </div>
        </main>
      }
    >
      <PlayPageContent />
    </Suspense>
  );
}

function PlaceholderGame({ title, templateId }: { title: string; templateId?: string | null }) {
  const labelMap: Record<string, string> = {
    runner_endless: "Runner placeholder",
    match3_basic: "Match3 placeholder",
    clicker_basic: "Clicker placeholder",
    platformer_basic: "Platformer placeholder",
    tower_defense_basic: "Tower Defense placeholder",
    placeholder_basic: "Template placeholder",
  };
  const templateLabel = (templateId && labelMap[templateId]) || "Template placeholder";
  return (
    <div className={styles.card}>
      <div className={styles.panelHeader}>
        <div>
          <p className={styles.kicker}>{templateLabel}</p>
          <h2 className={styles.title}>{title}</h2>
          <p className={styles.subtle}>Runtime no implementado aún. Usa este placeholder jugable.</p>
        </div>
      </div>
      <div className={styles.card}>
        <p className={styles.itemTitle}>Cómo jugar</p>
        <p className={styles.muted}>Prototipo en espera. Implementa el template o redirige a una demo.</p>
        <p className={styles.muted}>No se han cargado assets; usa los controles descritos en tu diseño.</p>
      </div>
    </div>
  );
}
