"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./afk.module.css";
import { AfkProvider, useAfk } from "@/lib/afkStore";

const nav = [
  { href: "/afk", label: "Campaña", hint: "Capítulos y stages" },
  { href: "/afk/battle", label: "Batalla", hint: "Auto 5v5" },
  { href: "/afk/heroes", label: "Héroes", hint: "Roster y skills" },
  { href: "/afk/idle", label: "Idle", hint: "Botín offline" },
  { href: "/afk/inventory", label: "Inventario", hint: "Botín y equipo" },
];

function format(num: number | undefined) {
  if (num === undefined) return "0";
  return num.toLocaleString("es-ES");
}

function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { state, bank } = useAfk();
  const isHome = pathname === "/afk" || pathname === "/afk/";
  const isGameRoute = pathname?.startsWith("/afk/battle") || pathname?.startsWith("/afk/map");
  const isShellRoute = pathname?.startsWith("/afk");

  return (
    <div className={`${styles.page} ${isGameRoute ? `${styles.gameRoute} ${styles.gameScreen}` : ""}`}>
      <div className={styles.skyLayer} />
      <div className={`${styles.pageInner} ${isGameRoute ? styles.gameRouteInner : ""}`}>
        {!isShellRoute && (
          <>
            <header className={styles.topHud}>
              <div>
                <div className={styles.brand}>AFK Arena-like</div>
                <p className={styles.muted}>Auto idle RPG con renderer 2.5D</p>
              </div>
              <div className={styles.hudStats}>
                <span>Oro {format(state?.resources.gold)}</span>
                <span>EXP {format(state?.resources.exp)}</span>
                <span>Materiales {format(state?.resources.materials)}</span>
              </div>
              <div className={styles.idleChip}>
                AFK Bank +{format(bank.gold)} oro / {format(bank.exp)} exp / {format(bank.materials)} mats
              </div>
              {!isHome && (
                <Link className={styles.hubLink} href="/afk">
                  Volver al hub
                </Link>
              )}
            </header>
            <section className={styles.content}>{children}</section>
            {isHome && (
              <nav className={styles.bottomNav}>
                {nav.map((item) => {
                  const active = pathname === item.href;
                  return (
                    <Link key={item.href} href={item.href} className={`${styles.navButton} ${active ? styles.active : ""}`}>
                      <span className={styles.navLabel}>{item.label}</span>
                      <span className={styles.navHint}>{item.hint}</span>
                    </Link>
                  );
                })}
              </nav>
            )}
          </>
        )}
        {isShellRoute && children}
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
