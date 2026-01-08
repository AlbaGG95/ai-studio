"use client";

import type { ReactNode } from "react";
import styles from "../afk.module.css";

type GameScreenShellProps = {
  background?: ReactNode;
  topHud?: ReactNode;
  bottomNav?: ReactNode;
  sideRail?: ReactNode;
  children?: ReactNode;
  className?: string;
};

export function GameScreenShell({ background, topHud, bottomNav, sideRail, children, className }: GameScreenShellProps) {
  const rootClass = className ? `${styles.gameShell} ${className}` : styles.gameShell;
  return (
    <div className={rootClass}>
      {background && <div className={styles.gameBg}>{background}</div>}
      {sideRail && <div className={styles.gameSideRail}>{sideRail}</div>}
      {topHud && <div className={styles.gameTopHud}>{topHud}</div>}
      <div className={styles.gameMain}>{children}</div>
      {bottomNav && <div className={styles.gameBottomNav}>{bottomNav}</div>}
    </div>
  );
}
