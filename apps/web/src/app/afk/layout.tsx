"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./afk.module.css";
import { AfkProvider, useAfk } from "@/lib/afkStore";

const nav = [
  { href: "/afk", label: "Mapa", hint: "Capítulos y stages" },
  { href: "/afk/battle", label: "Batalla", hint: "Auto 5v5" },
  { href: "/afk/heroes", label: "Héroes", hint: "Mejora y equipo" },
  { href: "/afk/idle", label: "Idle", hint: "Botín offline" },
];

function format(num: number | undefined) {
  if (num === undefined) return "0";
  return num.toLocaleString("es-ES");
}

function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { state, bank } = useAfk();

  return (
    <div className={styles.page}>
      <div className={styles.shell}>
        <aside className={styles.nav}>
          <div className={styles.brand}>AFK Vertical Slice</div>
          <p className={styles.navStats}>
            Oro {format(state?.resources.gold)} · EXP {format(state?.resources.exp)} · Materiales {format(state?.resources.materials)}
          </p>
          <p className={styles.navStats}>
            Stage actual {state?.campaign.currentStageId ?? "1-1"} · Botín AFK +{format(bank.gold)} oro
          </p>
          <div className={styles.navList}>
            {nav.map((item) => (
              <Link key={item.href} href={item.href} className={`${styles.navButton} ${pathname === item.href ? styles.active : ""}`}>
                <span>{item.label}</span>
                <span className={styles.muted}>{item.hint}</span>
              </Link>
            ))}
          </div>
        </aside>
        <section className={styles.content}>{children}</section>
      </div>
    </div>
  );
}

export default function AfkLayout({ children }: { children: React.ReactNode }) {
  return (
    <AfkProvider>
      <Shell>{children}</Shell>
    </AfkProvider>
  );
}
