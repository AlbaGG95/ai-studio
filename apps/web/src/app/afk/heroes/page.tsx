"use client";

import styles from "../afk.module.css";
import { HeroPortrait } from "../components/HeroPortrait";
import { levelUpCostLabel, useAfk } from "@/lib/afkStore";

function format(num: number | undefined) {
  if (num === undefined) return "0";
  return num.toLocaleString("es-ES");
}

export default function HeroesPage() {
  const { state, heroVisuals, levelUpHero, toggleActive } = useAfk();
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
        <p className={styles.muted}>Oro {format(state.resources.gold)} · EXP {format(state.resources.exp)} · Materiales {format(state.resources.materials)}</p>
        <p className={styles.muted}>Activos {state.activeHeroIds.length}/5 en combate</p>
      </div>
      <div className={`${styles.card} ${styles.fullWidth}`}>
        <p className={styles.sectionTitle}>Roster ({state.heroes.length})</p>
        <div className={styles.heroGrid}>
          {state.heroes.map((hero) => {
            const visual = heroVisuals[hero.id];
            const cost = levelUpCostLabel(hero);
            const isActive = state.activeHeroIds.includes(hero.id);
            return (
              <div key={hero.id} className={`${styles.heroTile} ${isActive ? styles.activeHero : ""}`}>
                <div className={styles.heroPortraitWrap}>
                  <HeroPortrait visual={visual} seed={hero.visualSeed} label={hero.rarity.toUpperCase()} />
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
                    <button className={styles.buttonPrimary} onClick={() => levelUpHero(hero.id)}>
                      Subir (+{format(cost.gold)} oro)
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
