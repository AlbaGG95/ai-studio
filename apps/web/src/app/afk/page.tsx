"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import styles from "./afk.module.css";
import { useAfk } from "@/lib/afkStore";
import { CampaignMap } from "./components/CampaignMap";
import { ProceduralIcon } from "./components/ProceduralIcon";
import { biomeForStage, generateIcon } from "@/lib/afkProcedural";

function format(num: number | undefined) {
  if (num === undefined) return "0";
  return num.toLocaleString("es-ES");
}

export default function CampaignPage() {
  const { state, stages, loading, setCurrentStage } = useAfk();
  const router = useRouter();

  if (loading || !state) {
    return (
      <div className={styles.card}>
        <p className={styles.muted}>Cargando campaña...</p>
      </div>
    );
  }

  const unlocked = new Set(state.campaign.unlockedStageIds);
  const completed = new Set(state.campaign.completedStageIds);
  const currentId = state.campaign.currentStageId;
  const nextStage =
    stages.find((s) => unlocked.has(s.id) && !completed.has(s.id)) ??
    stages.find((s) => unlocked.has(s.id)) ??
    stages[0];
  const biome = biomeForStage(nextStage ?? stages[0]);

  return (
    <div className={styles.grid}>
      <div className={`${styles.card} ${styles.heroBanner}`}>
        <div>
          <p className={styles.kicker}>Capítulo {stages[0].chapter}</p>
          <h1 className={styles.title}>Mapa vivo de campaña</h1>
          <p className={styles.muted}>
            Progreso {state.campaign.completedStageIds.length}/{stages.length}. Cada victoria desbloquea el siguiente stage y mejora el botín
            idle.
          </p>
          <div className={styles.actions} style={{ marginTop: 10, gap: 12 }}>
            <Link className={styles.buttonPrimary} href={`/afk/battle?stageId=${nextStage?.id}`}>
              Luchar stage {nextStage?.id ?? "1-1"}
            </Link>
            <button className={styles.buttonGhost} onClick={() => setCurrentStage(nextStage?.id ?? currentId)}>
              Fijar stage actual
            </button>
          </div>
        </div>
        <div className={styles.biomeBadge}>
          <span className={styles.tag}>Bioma</span>
          <strong>{biome.name}</strong>
          <p className={styles.mutedSmall}>{biome.props.join(" · ")}</p>
        </div>
      </div>

      <div className={`${styles.card} ${styles.fullWidth}`}>
        <p className={styles.sectionTitle}>World map</p>
        <CampaignMap
          stages={stages}
          currentId={currentId}
          unlocked={unlocked}
          completed={completed}
          onSelect={setCurrentStage}
          onBattle={(id) => {
            setCurrentStage(id);
            router.push(`/afk/battle?stageId=${id}`);
          }}
        />
      </div>

      <div className={`${styles.card} ${styles.fullWidth}`}>
        <p className={styles.sectionTitle}>Progreso y recompensas</p>
        <div className={styles.stageTimeline}>
          {stages.map((stage) => {
            const isUnlocked = unlocked.has(stage.id);
            const isCompleted = completed.has(stage.id);
            const isCurrent = stage.id === currentId;
            const status = isCompleted ? "Completado" : isUnlocked ? "Disponible" : "Bloqueado";
            return (
              <div key={stage.id} className={`${styles.stageChip} ${isCurrent ? styles.currentStage : ""} ${!isUnlocked ? styles.locked : ""}`}>
                <div className={styles.row}>
                  <span className={styles.tag}>{stage.id}</span>
                  <span className={styles.muted}>{status}</span>
                </div>
                <p className={styles.cardTitle}>Poder recomendado {format(stage.recommendedPower)}</p>
                <div className={styles.rewardIcons}>
                  <ProceduralIcon icon={generateIcon(`${stage.id}-gold`)} label={`+${format(stage.reward.gold)} oro`} />
                  <ProceduralIcon icon={generateIcon(`${stage.id}-exp`)} label={`+${format(stage.reward.exp)} exp`} />
                  <ProceduralIcon icon={generateIcon(`${stage.id}-mat`)} label={`+${format(stage.reward.materials)} mats`} />
                </div>
                <div className={styles.actions}>
                  <button className={styles.buttonGhost} disabled={!isUnlocked} onClick={() => setCurrentStage(stage.id)}>
                    Seleccionar
                  </button>
                  <Link
                    href={`/afk/battle?stageId=${stage.id}`}
                    className={`${styles.buttonPrimary} ${!isUnlocked ? styles.disabled : ""}`}
                    aria-disabled={!isUnlocked}
                  >
                    Luchar
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
