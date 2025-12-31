"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./afk.module.css";
import { AfkView, useAfkGame } from "@/lib/afkStore";

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
    exportState,
    importState,
    resetState,
  } = useAfkGame();

  useEffect(() => {
    if (player && !selectedHeroId && player.heroes.length) {
      setSelectedHeroId(player.heroes[0].id);
    }
  }, [player, selectedHeroId]);

  const selectedHero = useMemo(
    () => player?.heroes.find((h) => h.id === selectedHeroId) ?? null,
    [player, selectedHeroId]
  );

  const stageProgress = player?.stage.progress ?? 0;

  return (
    <main className={styles.page}>
      <div className={styles.toastWrap}>
        {toasts.map((toast) => (
          <div key={toast.id} className={`${styles.toast} ${styles[toast.tone]}`}>
            {toast.text}
          </div>
        ))}
      </div>
      <div className={styles.shell}>
        <aside className={styles.nav}>
          <div className={styles.brand}>AFK Loop</div>
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
              <p className={styles.kicker}>Idle RPG</p>
              <h1 className={styles.title}>AFK Arena-like UI</h1>
              <p className={styles.muted}>Loop, heroes, upgrades y settings persistentes.</p>
            </div>
            <div className={styles.actions}>
              <button className={styles.buttonGhost} onClick={claimBank} disabled={loading || !player}>
                Collect
              </button>
              <button className={styles.buttonPrimary} onClick={startBattle} disabled={loading || !player}>
                Start / Auto
              </button>
            </div>
          </div>

          {loading && <p className={styles.muted}>Cargando loop AFK...</p>}

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
                          <span className={styles.statValue}>{format(player.resources.gold)}</span>
                        </div>
                        <div className={styles.stat}>
                          <span className={styles.muted}>Esencia</span>
                          <span className={styles.statValue}>{format(player.resources.essence)}</span>
                        </div>
                      </div>
                      <p className={styles.muted}>Idle por minuto: {format(idlePerMinute.gold)} oro / {format(idlePerMinute.essence)} esencia</p>
                      <div className={styles.actions} style={{ marginTop: 10 }}>
                        <button className={styles.buttonPrimary} onClick={claimBank}>Collect</button>
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
                      <p className={styles.label}>Banco AFK</p>
                      <p className={styles.cardTitle}>+{format(banked.gold)} oro / +{format(banked.essence)} esencia</p>
                      <p className={styles.muted}>Se acumula mientras estás fuera.</p>
                    </div>
                  </div>
                </>
              )}

              {view === "heroes" && (
                <div className={styles.grid} style={{ gridTemplateColumns: "2fr 1fr" }}>
                  <div className={styles.card}>
                    <p className={styles.sectionTitle}>Roster</p>
                    <div className={styles.list}>
                      {player.heroes.map((hero) => (
                        <div key={hero.id} className={styles.heroRow}>
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
                        <button className={styles.buttonPrimary} onClick={startBattle}>Start</button>
                      </div>
                    </div>
                    <div className={styles.progressBar}>
                      <div className={styles.progressFill} style={{ width: `${Math.min(100, stageProgress * 100)}%` }} />
                    </div>
                    <p className={styles.muted} style={{ marginTop: 8 }}>Log de combate</p>
                    <div className={styles.combatLog}>
                      {events.slice(0, 8).map((ev) => (
                        <div key={ev.id} className={styles.logLine}>
                          {ev.text}
                        </div>
                      ))}
                      {events.length === 0 && <p className={styles.muted}>Aún sin eventos.</p>}
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
