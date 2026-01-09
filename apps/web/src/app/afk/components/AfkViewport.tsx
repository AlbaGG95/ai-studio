"use client";

import { useEffect, useRef } from "react";

type AfkViewportProps = {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
};

/**
 * Full-viewport wrapper for AFK routes to avoid canvas height collapse and prevent document scrolling.
 */
export function AfkViewport({ children, className, style }: AfkViewportProps) {
  const prevDocOverflow = useRef<string | null>(null);
  const prevBodyOverflow = useRef<string | null>(null);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const docEl = document.documentElement;
    const body = document.body;
    prevDocOverflow.current = docEl.style.overflow;
    prevBodyOverflow.current = body.style.overflow;
    docEl.style.overflow = "hidden";
    body.style.overflow = "hidden";
    return () => {
      docEl.style.overflow = prevDocOverflow.current ?? "";
      body.style.overflow = prevBodyOverflow.current ?? "";
    };
  }, []);

  return (
    <div
      className={className}
      style={{
        width: "100vw",
        height: "100dvh",
        minHeight: "100vh",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        position: "relative",
        ...style,
      }}
    >
      <div
        style={{
          flex: 1,
          minHeight: 0,
          minWidth: 0,
          width: "100%",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {children}
      </div>
    </div>
  );
}
