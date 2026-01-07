"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "../afk.module.css";
import { HeroPortrait } from "../components/HeroPortrait";
import { ProceduralIcon } from "../components/ProceduralIcon";
import { buildSkillset, generateIcon } from "@/lib/afkProcedural";
import { getTeamPower, levelUpCostLabel, useAfk } from "@/lib/afkStore";

function format(num: number | undefined) {
  if (num === undefined) return "0";
  return num.toLocaleString("es-ES");
}

export default function HeroesPage() {
  const { state, heroVisuals, levelUpHero, toggleActive, lastBattleSummary } = useAfk();
  const [tab, setTab] = useState<"heroes" | "formations" | "portraits">("heroes");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [powerHighlight, setPowerHighlight] = useState(false);
  const [upgradeHint, setUpgradeHint] = useState(false);

  const heroes = state?.heroes ?? [];
  const selectedHero = heroes.find((h) => h.id === (selectedId ?? heroes[0]?.id)) ?? heroes[0];
  const selectedVisual = selectedHero && heroVisuals[selectedHero.id] ? heroVisuals[selectedHero.id] : undefined;
  const skillset = useMemo(() => (selectedHero ? buildSkillset(selectedHero as any) : []), [selectedHero]);
  const teamPower = useMemo(() => getTeamPower(state ?? null), [state]);

  const canUpgrade =
    state?.heroes?.some((hero) => {
      const cost = levelUpCostLabel(hero);
      return cost.gold <= (state?.resources.gold ?? 0);
    }) ?? false;

  useEffect(() => {
    if (lastBattleSummary) {
      setPowerHighlight(true);
      const t = setTimeout(() => setPowerHighlight(false), 1400);
      return () => clearTimeout(t);
    }
    return;
  }, [lastBattleSummary]);

  useEffect(() => {
    if (canUpgrade) {
      setUpgradeHint(true);
      const t = setTimeout(() => setUpgradeHint(false), 1600);
      return () => clearTimeout(t);
    }
    return;
  }, [canUpgrade]);

  if (!state) {
    return (
      <div className={styles.card}>
        <p className={styles.muted}>Cargando héroes...</p>
      </div>
    );
  }

  return (
    <div className={styles.grid}>
      <div className={styles.card}>
        <p className={styles.sectionTitle}>Recursos</p>
        <p className={styles.muted}>
          Oro {format(state.resources.gold)} · EXP {format(state.resources.exp)} · Materiales {format(state.resources.materials)}
        </p>
        <p className={styles.muted}>Activos {state.activeHeroIds.length}/5 en combate</p>
      </div>

      <div className={styles.card}>
        <p className={styles.sectionTitle}>Poder de equipo</p>
        <h2
          className={styles.title}
          style={{
            color: powerHighlight ? "#bbf7d0" : undefined,
            textShadow: powerHighlight ? "0 0 12px rgba(74,222,128,0.45)" : "none",
            transition: "all 160ms ease-out",
          }}
        >
          {format(teamPower)} {powerHighlight ? "↑" : ""}
        </h2>
        <p className={styles.mutedSmall}>Sube con mejoras, idle y victorias.</p>
      </div>

      <div className={`${styles.card} ${styles.fullWidth}`}>
        <div className={styles.tabRow}>
          <button className={`${styles.tabButton} ${tab === "heroes" ? styles.activeTab : ""}`} onClick={() => setTab("heroes")}>
            Héroes
          </button>
          <button className={`${styles.tabButton} ${tab === "formations" ? styles.activeTab : ""}`} onClick={() => setTab("formations")}>
            Formaciones
          </button>
          <button className={`${styles.tabButton} ${tab === "portraits" ? styles.activeTab : ""}`} onClick={() => setTab("portraits")}>
            Retratos
          </button>
        </div>

        {tab === "heroes" && (
          <div className={styles.heroGrid}>
            {state.heroes.map((hero) => {
              const visual = heroVisuals[hero.id];
              const cost = levelUpCostLabel(hero);
              const isActive = state.activeHeroIds.includes(hero.id);
              const canAfford = cost.gold <= state.resources.gold;
              return (
                <div
                  key={hero.id}
                  className={`${styles.heroTile} ${isActive ? styles.activeHero : ""}`}
                  onClick={() => setSelectedId(hero.id)}
                  role="button"
                >
                  <div className={styles.heroPortraitWrap}>
                    <HeroPortrait visual={visual} seed={hero.visualSeed} role={hero.role} rarity={hero.rarity} label={hero.rarity.toUpperCase()} />
                  </div>
                  <div className={styles.heroInfo}>
                    <div className={styles.row}>
                      <strong>{hero.name}</strong>
                      <span className={styles.tag}>Lvl {hero.level}</span>
                    </div>
                    <p className={styles.muted}>Rol {hero.role} · Poder {format(hero.power)}</p>
                    <p className={styles.muted}>
                      HP {format(hero.stats.hp)} · ATK {format(hero.stats.atk)} · DEF {format(hero.stats.def)} · SPD {format(hero.stats.speed)}
                    </p>
                    <div className={styles.actions}>
                      <button className={styles.buttonGhost} onClick={() => toggleActive(hero.id)}>
                        {isActive ? "Quitar del equipo" : "Activar"}
                      </button>
                      <button
                        className={styles.buttonPrimary}
                        onClick={() => levelUpHero(hero.id)}
                        style={{
                          boxShadow: upgradeHint && canAfford ? "0 0 14px rgba(251,191,36,0.45)" : "none",
                          transition: "box-shadow 160ms ease-out",
                        }}
                      >
                        {canAfford && upgradeHint ? "Upgrade disponible" : "Subir"} (+{format(cost.gold)} oro)
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {tab === "formations" && (
          <div className={styles.formationGrid}>
            {state.activeHeroIds.map((id, idx) => {
              const hero = state.heroes.find((h) => h.id === id);
              if (!hero) return null;
              const visual = heroVisuals[hero.id];
              return (
                <div key={id} className={styles.slotCard}>
                  <span className={styles.tag}>Slot {idx + 1}</span>
                  <HeroPortrait visual={visual} seed={hero.visualSeed} role={hero.role} rarity={hero.rarity} name={hero.name} />
                  <p className={styles.muted}>Rol {hero.role}</p>
                  <button className={styles.buttonGhost} onClick={() => toggleActive(hero.id)}>
                    Quitar
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {tab === "portraits" && (
          <div className={styles.portraitGallery}>
            {state.heroes.map((hero) => (
              <HeroPortrait key={hero.id} visual={heroVisuals[hero.id]} seed={hero.visualSeed} role={hero.role} rarity={hero.rarity} name={hero.name} />
            ))}
          </div>
        )}
      </div>

      {selectedHero && selectedVisual && (
        <div className={`${styles.card} ${styles.fullWidth} ${styles.heroDetail}`}>
          <div className={styles.heroDetailHeader}>
            <HeroPortrait visual={selectedVisual} seed={selectedHero.visualSeed} role={selectedHero.role} rarity={selectedHero.rarity} name={selectedHero.name} />
            <div>
              <p className={styles.sectionTitle}>{selectedHero.name}</p>
              <p className={styles.muted}>
                {selectedHero.role} · Lvl {selectedHero.level} · Poder {format(selectedHero.power)}
              </p>
              <div className={styles.statsRow}>
                <span>HP {format(selectedHero.stats.hp)}</span>
                <span>ATK {format(selectedHero.stats.atk)}</span>
                <span>DEF {format(selectedHero.stats.def)}</span>
                <span>SPD {format(selectedHero.stats.speed)}</span>
              </div>
            </div>
          </div>
          <div className={styles.skillGrid}>
            {skillset.map((skill) => (
              <div key={skill.id} className={styles.skillCard}>
                <ProceduralIcon icon={skill.icon} />
                <div>
                  <strong>{skill.name}</strong>
                  <p className={styles.mutedSmall}>{skill.description}</p>
                </div>
              </div>
            ))}
          </div>
          <div className={styles.equipmentRow}>
            {["Arma", "Armadura", "Reliquia"].map((slot) => (
              <div key={slot} className={styles.slotCard}>
                <ProceduralIcon icon={generateIcon(`${selectedHero.id}-${slot}`)} label={slot} />
                <p className={styles.mutedSmall}>Auto-asignado por facción</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
