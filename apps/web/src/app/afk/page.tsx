"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import styles from "./afk.module.css";
import { useAfk } from "@/lib/afkStore";
import { CampaignMap } from "./components/CampaignMap";
import { ProceduralIcon } from "./components/ProceduralIcon";
import { biomeForStage, generateIcon } from "@/lib/afkProcedural";
import { buildCampaignViewModel } from "@/game/campaign/campaignViewModel";

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
      <div className={styles.card}>
        <p className={styles.muted}>Cargando campana...</p>
      </div>
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
    <div className={styles.grid}>
      <div className={`${styles.card} ${styles.heroBanner}`}>
        <div>
          <p className={styles.kicker}>Capitulo {stages[0].chapter}</p>
          <h1 className={styles.title}>Mapa vivo de campana</h1>
          <p className={styles.muted}>
            Progreso {completed.size}/{stages.length}. Cada victoria desbloquea el siguiente stage y mejora el boton idle.
          </p>
          <div className={styles.actions} style={{ marginTop: 10, gap: 12 }}>
            <Link className={styles.buttonPrimary} href={`/afk/battle?stageId=${nextStage.id}`}>
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
          onSelect={(id) => {
            if (!unlocked.has(id)) return;
            setCurrentStage(id);
          }}
          onBattle={(id) => {
            if (!unlocked.has(id)) return;
            setCurrentStage(id);
            router.push(`/afk/battle?stageId=${id}`);
          }}
        />
      </div>

      <div className={`${styles.card} ${styles.fullWidth}`}>
        <p className={styles.sectionTitle}>Progreso y recompensas</p>
        <div className={styles.stageTimeline}>
          {stages.map((stage) => {
            const stageState = stageStateMap.get(stage.id) ?? "locked";
            const isUnlocked = stageState !== "locked";
            const isCompleted = stageState === "completed";
            const isCurrent = stage.id === currentId;
            const status = isCompleted ? "Completado" : isUnlocked ? "Disponible" : "Bloqueado";
            return (
              <div
                key={stage.id}
                className={`${styles.stageChip} ${isCurrent ? styles.currentStage : ""} ${!isUnlocked ? styles.locked : ""}`}
              >
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
                  <button className={styles.buttonGhost} disabled={!isUnlocked} onClick={() => isUnlocked && setCurrentStage(stage.id)}>
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
