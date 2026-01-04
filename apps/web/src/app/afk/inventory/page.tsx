"use client";

import { useMemo } from "react";
import styles from "../afk.module.css";
import { ProceduralIcon } from "../components/ProceduralIcon";
import { seedInventory } from "@/lib/afkProcedural";
import { useAfk } from "@/lib/afkStore";

export default function InventoryPage() {
  const { state, stages } = useAfk();
  const currentStage = stages.find((s) => s.id === state?.campaign.currentStageId) ?? stages[0];
  const inventory = useMemo(() => seedInventory(currentStage as any), [currentStage]);

  if (!state) {
    return (
      <div className={styles.card}>
        <p className={styles.muted}>Cargando inventario...</p>
      </div>
    );
  }

  return (
    <div className={styles.grid}>
      <div className={`${styles.card} ${styles.fullWidth}`}>
        <p className={styles.sectionTitle}>Inventario procedimental</p>
        <p className={styles.muted}>Botín generado por bioma y stage actual. No afecta al combate, solo presentación.</p>
        <div className={styles.inventoryGrid}>
          {inventory.map((item) => (
            <div key={item.id} className={styles.slotCard}>
              <ProceduralIcon icon={item.icon} />
              <strong>{item.name}</strong>
              <p className={styles.mutedSmall}>{item.kind}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
