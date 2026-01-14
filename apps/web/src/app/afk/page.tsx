"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import styles from "./afk.module.css";
import { useAfk } from "@/lib/afkStore";
import { CampaignMap } from "./components/CampaignMap";
import { biomeForStage } from "@/lib/afkProcedural";
import { buildCampaignViewModel } from "@/game/campaign/campaignViewModel";
import { GameScreenShell } from "./components/GameScreenShell";
import { AfkViewport } from "./components/AfkViewport";

function format(num: number | undefined) {
  if (num === undefined) return "0";
  return num.toLocaleString("es-ES");
}

export default function CampaignPage() {
  const { state, stages, loading, setCurrentStage } = useAfk();
  const router = useRouter();
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const topHudRef = useRef<HTMLDivElement | null>(null);
  const bottomNavRef = useRef<HTMLElement | null>(null);

  const campaign = buildCampaignViewModel(state, stages);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.localStorage?.getItem("afkDebugLayout") !== "1") return;

    const logLayout = () => {
      const mapRect = mapContainerRef.current?.getBoundingClientRect();
      const topRect = topHudRef.current?.getBoundingClientRect();
      const bottomRect = bottomNavRef.current?.getBoundingClientRect();
      const topPosition = topHudRef.current
        ? window.getComputedStyle(topHudRef.current).position
        : "n/a";
      const bottomPosition = bottomNavRef.current
        ? window.getComputedStyle(bottomNavRef.current).position
        : "n/a";

      console.info("[afk-layout]", {
        map: {
          width: mapRect?.width ?? 0,
          height: mapRect?.height ?? 0,
        },
        topHud: {
          visible: !!topRect && topRect.height > 0,
          height: topRect?.height ?? 0,
          position: topPosition,
        },
        bottomNav: {
          visible: !!bottomRect && bottomRect.height > 0,
          height: bottomRect?.height ?? 0,
          position: bottomPosition,
        },
      });
    };

    const raf = window.requestAnimationFrame(logLayout);
    window.addEventListener("resize", logLayout);
    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("resize", logLayout);
    };
  }, []);

  if (loading || !state || !campaign) {
    return (
      <AfkViewport>
        <GameScreenShell className={`${styles.homeShell} ${styles.page}`}>
          <div className={styles.homeBg} ref={mapContainerRef} />
        </GameScreenShell>
      </AfkViewport>
    );
  }

  const stageStateMap = new Map(
    campaign.stages.map((stage) => [stage.id, stage.state])
  );
  const completed = new Set(
    campaign.stages.filter((s) => s.state === "completed").map((s) => s.id)
  );
  const unlocked = new Set<string>(completed);
  unlocked.add(campaign.currentStageId);
  const currentId = campaign.currentStageId;
  const currentStage = stages.find((s) => s.id === currentId) ?? stages[0];
  const nextStage = currentStage ?? stages[0];
  const biome = biomeForStage(nextStage);

  return (
    <AfkViewport>
      <GameScreenShell
        className={`${styles.homeShell} ${styles.page}`}
        background={
          <div className={styles.homeBg} ref={mapContainerRef}>
            <CampaignMap
              stages={stages}
              currentId={currentId}
              unlocked={unlocked}
              completed={completed}
              onSelect={() => {}}
              onBattle={() => {}}
              variant="background"
            />
          </div>
        }
        topHud={
          <div
            ref={topHudRef}
            className={`${styles.card} ${styles.heroBanner}`}
            style={{ margin: 0 }}
          >
            <div>
              <p className={styles.kicker}>Capitulo {stages[0].chapter}</p>
              <h1 className={styles.title}>Mapa vivo de campana</h1>
              <p className={styles.muted}>
                Progreso {completed.size}/{stages.length}. Cada victoria
                desbloquea el siguiente stage y mejora el boton idle.
              </p>
              <div
                className={styles.actions}
                style={{ marginTop: 10, gap: 12 }}
              >
                <Link
                  className={styles.buttonPrimary}
                  href={`/afk/battle?stageId=${nextStage.id}`}
                >
                  Luchar stage {nextStage.id}
                </Link>
                <button
                  className={styles.buttonGhost}
                  onClick={() => setCurrentStage(nextStage.id)}
                >
                  Fijar stage actual
                </button>
              </div>
            </div>
            <div className={styles.biomeBadge}>
              <span className={styles.tag}>Bioma</span>
              <strong>{biome.name}</strong>
              <p className={styles.mutedSmall}>{biome.props.join(" / ")}</p>
            </div>
          </div>
        }
        bottomNav={
          <nav className={styles.bottomNav} ref={bottomNavRef}>
            <Link href="/afk/map" className={styles.navButton}>
              <span className={styles.navLabel}>Campana</span>
              <span className={styles.navHint}>Mapa</span>
            </Link>
            <Link href="/afk/battle" className={styles.navButton}>
              <span className={styles.navLabel}>Batalla</span>
              <span className={styles.navHint}>Auto 5v5</span>
            </Link>
            <Link href="/afk/heroes" className={styles.navButton}>
              <span className={styles.navLabel}>Heroes</span>
              <span className={styles.navHint}>Roster</span>
            </Link>
            <Link href="/afk/idle" className={styles.navButton}>
              <span className={styles.navLabel}>Idle</span>
              <span className={styles.navHint}>Boton</span>
            </Link>
            <Link href="/afk/inventory" className={styles.navButton}>
              <span className={styles.navLabel}>Inventario</span>
              <span className={styles.navHint}>Equipo</span>
            </Link>
          </nav>
        }
      >
        <div className={styles.homeOverlay}>
          <div className={styles.card} style={{ maxWidth: 400 }}>
            <p className={styles.sectionTitle}>Stage actual</p>
            <p className={styles.muted}>
              Recomendado {format(nextStage.recommendedPower)}
            </p>
            <div className={styles.actions} style={{ marginTop: 10, gap: 12 }}>
              <Link
                className={styles.buttonPrimary}
                href={`/afk/battle?stageId=${nextStage.id}`}
              >
                Luchar
              </Link>
              <button
                className={styles.buttonGhost}
                onClick={() => setCurrentStage(nextStage.id)}
              >
                Seleccionar
              </button>
            </div>
          </div>
        </div>
      </GameScreenShell>
    </AfkViewport>
  );
}
