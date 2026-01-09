"use client";

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

  const campaign = buildCampaignViewModel(state, stages);

  if (loading || !state || !campaign) {
    return (
      <AfkViewport>
        <GameScreenShell className={${styles.homeShell} }>
          <div className={styles.homeBg} />
        </GameScreenShell>
      </AfkViewport>
    );
  }

  const stageStateMap = new Map(campaign.stages.map((stage) => [stage.id, stage.state]));
  const completed = new Set(campaign.stages.filter((s) => s.state === "completed").map((s) => s.id));
  const unlocked = new Set<string>(completed);
  unlocked.add(campaign.currentStageId);
  const currentId = campaign.currentStageId;
  const currentStage = stages.find((s) => s.id === currentId) ?? stages[0];
  const nextStage = currentStage ?? stages[0];
  const biome = biomeForStage(nextStage);

  return (
    <AfkViewport>
      <GameScreenShell
        className={${styles.homeShell} }
        background={
          <div className={styles.homeBg}>
            <CampaignMap
              stages={stages}
              currentId={currentId}
              unlocked={unlocked}
              completed={completed}
              onSelect={() => {}}
              onBattle={() => {}}
            />
          </div>
        }
        topHud={
          <div className={${styles.card} } style={{ margin: 0 }}>
            <div>
              <p className={styles.kicker}>Capitulo {stages[0].chapter}</p>
              <h1 className={styles.title}>Mapa vivo de campana</h1>
              <p className={styles.muted}>
                Progreso {completed.size}/{stages.length}. Cada victoria desbloquea el siguiente stage y mejora el boton idle.
              </p>
              <div className={styles.actions} style={{ marginTop: 10, gap: 12 }}>
                <Link className={styles.buttonPrimary} href={/afk/battle?stageId=}>
                  Luchar stage {nextStage.id}
                </Link>
                <button className={styles.buttonGhost} onClick={() => setCurrentStage(nextStage.id)}>
                  Fijar stage actual
                </button>
              </div>
            </div>
            <div className={styles.biomeBadge}>
              <span className={styles.tag}>Bioma</span>
              <strong>{biome.name}</strong>
              <p className={styles.mutedSmall}>{biome.props.join(" Ñ-¥s ")}</p>
            </div>
          </div>
        }
        bottomNav={
          <nav className={styles.bottomNav}>
            <Link href="/afk/map" className={styles.navButton}>
              <span className={styles.navLabel}>CampaÇña</span>
              <span className={styles.navHint}>Mapa</span>
            </Link>
            <Link href="/afk/battle" className={styles.navButton}>
              <span className={styles.navLabel}>Batalla</span>
              <span className={styles.navHint}>Auto 5v5</span>
            </Link>
            <Link href="/afk/heroes" className={styles.navButton}>
              <span className={styles.navLabel}>HÇ¸roes</span>
              <span className={styles.navHint}>Roster</span>
            </Link>
            <Link href="/afk/idle" className={styles.navButton}>
              <span className={styles.navLabel}>Idle</span>
              <span className={styles.navHint}>BotÇðn</span>
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
            <p className={styles.muted}>Recomendado {format(nextStage.recommendedPower)}</p>
            <div className={styles.actions} style={{ marginTop: 10, gap: 12 }}>
              <Link className={styles.buttonPrimary} href={/afk/battle?stageId=}>
                Luchar
              </Link>
              <button className={styles.buttonGhost} onClick={() => setCurrentStage(nextStage.id)}>
                Seleccionar
              </button>
            </div>
          </div>
        </div>
      </GameScreenShell>
    </AfkViewport>
  );
}
