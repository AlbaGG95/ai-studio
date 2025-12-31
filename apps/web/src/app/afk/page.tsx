"use client";

import { CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import styles from "./afk.module.css";
import { AfkView, useAfkGame } from "@/lib/afkStore";
import { GameConfig, gameConfigs, defaultGameConfigId } from "@/config/gameConfigs";

const views: { id: AfkView; label: string; hint: string }[] = [
  { id: "home", label: "Home", hint: "Resumen y claim" },
  { id: "heroes", label: "Heroes", hint: "Gestiona el roster" },
  { id: "battle", label: "Battle", hint: "Auto-combate" },
  { id: "upgrades", label: "Upgrades", hint: "Mejoras globales" },
  { id: "settings", label: "Settings", hint: "Reset / export" },
];

function format(num: number | undefined) {
  if (num === undefined) return "0";
  return num.toLocaleString("es-ES");
}

export default function AfkPage() {
  const [view, setView] = useState<AfkView>("home");
  const [selectedHeroId, setSelectedHeroId] = useState<string | null>(null);
  const [importText, setImportText] = useState("");
  const [collecting, setCollecting] = useState(false);
  const [demoMode, setDemoMode] = useState(false);
  const [pulse, setPulse] = useState({ gold: false, essence: false, bank: false });
  const [configId, setConfigId] = useState<string>(defaultGameConfigId);
  const prevResources = useRef({ gold: 0, essence: 0, bankGold: 0, bankEssence: 0 });
  const config = useMemo(() => {
    const found = gameConfigs.find((c) => c.id === configId) ?? gameConfigs[0];
    return found;
  }, [configId]);
  const themeStyle = useMemo<CSSProperties>(() => {
    const colors = config.themeTokens.colors;
    return {
      ["--theme-bg-1" as string]: colors.bg1,
      ["--theme-bg-2" as string]: colors.bg2,
      ["--theme-panel" as string]: colors.panel,
      ["--theme-border" as string]: colors.border,
      ["--theme-text" as string]: colors.text,
      ["--theme-muted" as string]: colors.muted,
      ["--theme-accent" as string]: colors.accent,
      ["--theme-accent-strong" as string]: colors.accentStrong,
      ["--theme-success" as string]: colors.success,
      ["--theme-warn" as string]: colors.warn,
      ["--theme-info" as string]: colors.info,
      ["--theme-gradient-start" as string]: colors.gradientStart,
      ["--theme-gradient-end" as string]: colors.gradientEnd,
      ["--theme-nav-bg" as string]: colors.navBg ?? "rgba(22, 30, 50, 0.9)",
      fontFamily: config.themeTokens.typography?.body,
    };
  }, [config]);

  const {
    player,
    loading,
    banked,
    idlePerMinute,
    lastCombat,
    events,
    toasts,
    claimBank,
    startBattle,
    upgradeHero,
    buyUpgrade,
    recruitHero,
    loadDemoState,
    exportState,
    importState,
    resetState,
  } = useAfkGame(config);

  useEffect(() => {
    if (player && !selectedHeroId && player.heroes.length) {
      setSelectedHeroId(player.heroes[0].id);
    }
  }, [player, selectedHeroId]);

  useEffect(() => {
    const stored = typeof window !== "undefined" ? window.localStorage.getItem("afk-config-id") : null;
    if (stored) setConfigId(stored);
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const fromQuery = params.get("configId") || params.get("config");
      if (fromQuery) setConfigId(fromQuery);
    }
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("afk-config-id", config.id);
    }
  }, [config.id]);

  useEffect(() => {
    if (!player) return;
    const nextPulse = { gold: false, essence: false, bank: false };
    const current = {
      gold: player.resources.gold,
      essence: player.resources.essence,
      bankGold: banked.gold ?? 0,
      bankEssence: banked.essence ?? 0,
    };
    const prev = prevResources.current;
    if (current.gold > prev.gold) nextPulse.gold = true;
    if (current.essence > prev.essence) nextPulse.essence = true;
    if (current.bankGold > prev.bankGold || current.bankEssence > prev.bankEssence) nextPulse.bank = true;
    setPulse(nextPulse);
    prevResources.current = current;
    const timer = setTimeout(() => setPulse({ gold: false, essence: false, bank: false }), 350);
    return () => clearTimeout(timer);
  }, [player, banked]);

  const selectedHero = useMemo(
    () => player?.heroes.find((h) => h.id === selectedHeroId) ?? null,
    [player, selectedHeroId]
  );

  const stageProgress = player?.stage.progress ?? 0;
  const onboardingHint = !loading && player && player.stage.index <= 1 && stageProgress < 0.05;

  return (
    <main className={styles.page} style={themeStyle}>
      <div className={styles.toastWrap}>
        {toasts.map((toast) => (
          <div key={toast.id} className={`${styles.toast} ${styles[toast.tone]}`}>
            {toast.text}
          </div>
        ))}
      </div>
      <div className={styles.shell}>
        <aside className={styles.nav}>
          <div className={styles.brand}>{config.name}</div>
          <p className={styles.navStats}>Recursos · oro {format(player?.resources.gold)} · esencia {format(player?.resources.essence)}</p>
          <p className={styles.navStats}>Stage · {player?.stage.index ?? 1}</p>
          <div className={styles.navList}>
            {views.map((item) => (
              <button
                key={item.id}
                className={`${styles.navButton} ${view === item.id ? styles.active : ""}`}
                onClick={() => setView(item.id)}
              >
                <span>{item.label}</span>
                <span className={styles.muted}>{item.hint}</span>
              </button>
            ))}
          </div>
        </aside>
        <section className={styles.content}>
          <div className={styles.header}>
            <div>
              <p className={styles.kicker}>{config.strings.title}</p>
              <h1 className={styles.title} style={{ fontFamily: config.themeTokens.typography?.heading }}>
                {config.strings.tagline}
              </h1>
              <p className={styles.muted}>Loop, heroes, upgrades y settings persistentes.</p>
            </div>
            <div className={styles.actions}>
              <button
                className={`${styles.buttonGhost} ${styles.collectPulse}`}
                onClick={() => {
                  setCollecting(true);
                  claimBank();
                  setTimeout(() => setCollecting(false), 500);
                }}
                disabled={loading || !player || collecting}
              >
                {config.strings.collectCta}
              </button>
              <button className={styles.buttonPrimary} onClick={startBattle} disabled={loading || !player}>
                {config.strings.startCta}
              </button>
            </div>
          </div>

          {loading && (
            <div className={styles.grid}>
              {[1, 2, 3].map((k) => (
                <div key={k} className={styles.card}>
                  <div className={styles.skeleton} style={{ width: "60%", marginBottom: 8 }} />
                  <div className={styles.skeleton} style={{ width: "80%", marginBottom: 6 }} />
                  <div className={styles.skeleton} style={{ width: "50%" }} />
                </div>
              ))}
            </div>
          )}

          {!loading && player && (
            <>
              {view === "home" && (
                <>
                  <div className={styles.grid}>
                    <div className={styles.card}>
                      <p className={styles.label}>Recursos</p>
                      <div className={styles.row}>
                        <div className={styles.stat}>
                          <span className={styles.muted}>Oro</span>
                          <span className={`${styles.statValue} ${pulse.gold ? styles.fadeIn : ""}`}>{format(player.resources.gold)}</span>
                        </div>
                        <div className={styles.stat}>
                          <span className={styles.muted}>Esencia</span>
                          <span className={`${styles.statValue} ${pulse.essence ? styles.fadeIn : ""}`}>{format(player.resources.essence)}</span>
                        </div>
                      </div>
                      <p className={styles.muted}>Idle por minuto: {format(idlePerMinute.gold)} oro / {format(idlePerMinute.essence)} esencia</p>
                      <div className={styles.actions} style={{ marginTop: 10 }}>
                        <button
                          className={`${styles.buttonPrimary} ${styles.collectPulse}`}
                          onClick={() => {
                            setCollecting(true);
                            claimBank();
                            setTimeout(() => setCollecting(false), 500);
                          }}
                          disabled={collecting}
                        >
                          {collecting ? "Collecting..." : "Collect"}
                        </button>
                        <span className={styles.pill}>Idle activo</span>
                      </div>
                    </div>
                    <div className={styles.card}>
                      <p className={styles.label}>Stage actual</p>
                      <p className={styles.cardTitle}>Stage {player.stage.index}</p>
                      <div className={styles.progressBar}>
                        <div className={styles.progressFill} style={{ width: `${Math.min(100, stageProgress * 100)}%` }} />
                      </div>
                      <p className={styles.muted}>Progreso hacia el combate</p>
                      <div className={styles.actions} style={{ marginTop: 8 }}>
                        <span className={styles.pill}>Reward: +{format(player.stage.reward.gold)} oro / +{format(player.stage.reward.essence)} esencia</span>
                      </div>
                    </div>
                    <div className={styles.card}>
                      <p className={styles.label}>{config.strings.bankLabel}</p>
                      <p className={`${styles.cardTitle} ${pulse.bank ? styles.fadeIn : ""}`}>
                        +{format(banked.gold)} oro / +{format(banked.essence)} esencia
                      </p>
                      <p className={styles.muted}>Se acumula mientras estás fuera.</p>
                    </div>
                  </div>
                  {onboardingHint && (
                    <div className={styles.card}>
                      <p className={styles.cardTitle}>Cómo avanzar</p>
                      <p className={styles.muted}>1) Pulsa Start para auto-combat. 2) Usa Collect para cobrar. 3) Sube de nivel a un héroe y vuelve al combate.</p>
                    </div>
                  )}
                </>
              )}

              {view === "heroes" && (
                <div className={styles.grid} style={{ gridTemplateColumns: "2fr 1fr" }}>
                  <div className={styles.card}>
                    <p className={styles.sectionTitle}>Roster</p>
                    {player.heroes.length === 0 ? (
                      <div className={styles.emptyState}>
                        <p>No tienes héroes aún.</p>
                        <div className={styles.actions} style={{ marginTop: 8 }}>
                          <button className={styles.buttonPrimary} onClick={recruitHero}>Recruit</button>
                        </div>
                      </div>
                    ) : (
                      <div className={styles.list}>
                        {player.heroes.map((hero) => (
                          <div key={hero.id} className={`${styles.heroRow} ${styles.transitionCard}`}>
                            <div className={styles.heroInfo}>
                              <strong>{hero.name}</strong>
                              <span className={styles.muted}>Nivel {hero.level} · Poder {format(hero.power)}</span>
                              <span className={styles.muted}>Rol {hero.role} · {hero.rarity}</span>
                            </div>
                            <div className={styles.actions}>
                              <button className={styles.buttonGhost} onClick={() => setSelectedHeroId(hero.id)}>Detalle</button>
                              <button className={styles.buttonPrimary} onClick={() => upgradeHero(hero.id)}>Upgrade</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className={styles.card}>
                    <p className={styles.sectionTitle}>Detalle</p>
                    {selectedHero ? (
                      <div className={styles.list}>
                        <div className={styles.row}>
                          <div>
                            <p className={styles.cardTitle}>{selectedHero.name}</p>
                            <p className={styles.muted}>Rarity {selectedHero.rarity}</p>
                          </div>
                          <span className={styles.tag}>Lvl {selectedHero.level}</span>
                        </div>
                        <p className={styles.muted}>Power {format(selectedHero.power)}</p>
                        <p className={styles.muted}>Equipo: {selectedHero.equipmentScore ?? 0}</p>
                        <p className={styles.muted}>Skills: {selectedHero.skills?.join(", ") ?? "N/A"}</p>
                        <button className={styles.buttonPrimary} onClick={() => upgradeHero(selectedHero.id)}>Subir nivel</button>
                      </div>
                    ) : (
                      <p className={styles.muted}>Selecciona un héroe para ver detalles.</p>
                    )}
                  </div>
                </div>
              )}

              {view === "battle" && (
                <div className={styles.grid} style={{ gridTemplateColumns: "1.5fr 1fr" }}>
                  <div className={styles.card}>
                    <div className={styles.header}>
                      <div>
                        <p className={styles.label}>Battle / Stages</p>
                        <p className={styles.cardTitle}>Stage {player.stage.index}</p>
                        <p className={styles.muted}>Enemy Power {format(player.stage.enemyPower)}</p>
                      </div>
                      <div className={styles.actions}>
                        <button className={styles.buttonPrimary} onClick={startBattle}>{config.strings.startCta}</button>
                      </div>
                    </div>
                    <div className={styles.progressBar}>
                      <div className={styles.progressFill} style={{ width: `${Math.min(100, stageProgress * 100)}%` }} />
                    </div>
                    <p className={styles.muted} style={{ marginTop: 8 }}>Log de combate</p>
                    <div className={styles.combatLog}>
                      {events.length === 0 && <p className={styles.muted}>Aún sin eventos. Ejecuta un combate para ver actividad.</p>}
                      {events.slice(0, 8).map((ev) => (
                        <div key={ev.id} className={`${styles.logLine} ${styles.fadeIn}`}>
                          {ev.text}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className={styles.card}>
                    <p className={styles.sectionTitle}>Resultado</p>
                    {lastCombat ? (
                      <div className={styles.list}>
                        <p className={styles.muted}>Resultado: {lastCombat.result}</p>
                        <p className={styles.muted}>Turnos: {lastCombat.turns}</p>
                        <p className={styles.muted}>Daño hecho: {format(Math.round(lastCombat.damageDealt))}</p>
                        <p className={styles.muted}>Daño recibido: {format(Math.round(lastCombat.damageTaken))}</p>
                      </div>
                    ) : (
                      <p className={styles.muted}>Lanza un combate para ver resultados.</p>
                    )}
                    <div className={styles.actions} style={{ marginTop: 12 }}>
                      <span className={styles.pill}>Auto-loop activo</span>
                    </div>
                  </div>
                </div>
              )}

              {view === "upgrades" && (
                <div className={styles.card}>
                  <p className={styles.sectionTitle}>Mejoras globales</p>
                  <div className={styles.list}>
                    {player.upgrades.map((up) => (
                      <div key={up.id} className={styles.upgradeRow}>
                        <div>
                          <p className={styles.cardTitle}>{up.name}</p>
                          <p className={styles.muted}>Nivel {up.level}{up.cap ? ` / ${up.cap}` : ""}</p>
                          <p className={styles.muted}>Efecto: recurso x{(up.effect.resourceRate ?? 0) + 1} · poder +{up.effect.combatPower ?? 0}</p>
                        </div>
                        <div className={styles.actions}>
                          <span className={styles.tag}>Costo {format(up.cost.gold * (up.level + 1))} oro</span>
                          <button className={styles.buttonPrimary} onClick={() => buyUpgrade(up.id)}>Upgrade</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {view === "settings" && (
                <div className={styles.grid}>
                  <div className={styles.card}>
                    <p className={styles.sectionTitle}>Persistencia</p>
                    <div className={styles.actions} style={{ marginBottom: 8 }}>
                      <label className={styles.muted}>
                        Skin / Config:
                        <select
                          value={configId}
                          onChange={(e) => setConfigId(e.target.value)}
                          style={{ marginLeft: 8, padding: "6px 8px", borderRadius: 8 }}
                        >
                          {gameConfigs.map((cfg) => (
                            <option key={cfg.id} value={cfg.id}>
                              {cfg.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <div className={styles.actions}>
                      <button className={styles.buttonPrimary} onClick={() => setImportText(exportState())}>Exportar</button>
                      <button className={styles.buttonGhost} onClick={resetState}>Reset (dev)</button>
                    </div>
                    <textarea
                      className={styles.inputArea}
                      value={importText}
                      onChange={(e) => setImportText(e.target.value)}
                      placeholder="Pega JSON para importar"
                    />
                    <div className={styles.actions} style={{ marginTop: 8 }}>
                      <button className={styles.buttonPrimary} onClick={() => importState(importText)}>Importar</button>
                    </div>
                    <div className={styles.actions} style={{ marginTop: 12 }}>
                      <label className={styles.muted}>
                        <input
                          type="checkbox"
                          checked={demoMode}
                          onChange={(e) => {
                            setDemoMode(e.target.checked);
                            if (e.target.checked) {
                              loadDemoState();
                            } else {
                              resetState();
                            }
                          }}
                          style={{ marginRight: 6 }}
                        />
                        Demo mode (rellena estado base)
                      </label>
                    </div>
                  </div>
                  <div className={styles.card}>
                    <p className={styles.sectionTitle}>Estado actual</p>
                    <p className={styles.muted}>Stage {player.stage.index}, oro {format(player.resources.gold)}, esencia {format(player.resources.essence)}</p>
                    <p className={styles.muted}>AFK bank {format(banked.gold)} / {format(banked.essence)}</p>
                    <p className={styles.muted}>Heroes activos: {player.activeHeroIds.length}</p>
                    <p className={styles.muted}>Ultimo tick: {new Date(player.lastTickAt).toLocaleTimeString()}</p>
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </main>
  );
}
