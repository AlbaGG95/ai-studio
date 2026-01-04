"use client";

import { useEffect, useRef } from "react";
import { Application, Graphics, Text } from "pixi.js";

export default function AfkMapPage() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const appRef = useRef<Application | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    let app: Application | null = null;
    let disposed = false;
    let layout: () => void = () => {};

    const onResize = () => {
      layout();
    };

    const boot = async () => {
      const createdApp = new Application();

      if (typeof (createdApp as any).init === "function") {
        await (createdApp as any).init({
          width: mount.clientWidth || window.innerWidth,
          height: mount.clientHeight || window.innerHeight,
          antialias: true,
          backgroundAlpha: 0,
        });
      } else {
        const width = mount.clientWidth || window.innerWidth;
        const height = mount.clientHeight || window.innerHeight;
        // @ts-ignore fallback for Pixi v7 style
        (createdApp as any).renderer?.resize?.(width, height);
      }

      if (disposed) {
        try {
          createdApp.destroy(true);
        } catch {
          // ignore destroy errors
        }
        return;
      }

      app = createdApp;
      appRef.current = createdApp;

      const view = ((createdApp as any).canvas ?? (createdApp as any).view) as HTMLCanvasElement;
      if (!view) {
        throw new Error("Pixi canvas/view not available after init");
      }
      canvasRef.current = view;
      mount.appendChild(view);

      const background = new Graphics();
      const label = new Text("AFK MAP", {
        fill: "#e8ecf4",
        fontSize: 48,
        fontWeight: "800",
        fontFamily: "Inter, sans-serif",
      });
      label.anchor.set(0.5);

      layout = () => {
        if (disposed || !app) return;
        const width = mount.clientWidth || window.innerWidth;
        const height = mount.clientHeight || window.innerHeight;
        app.renderer.resize(width, height);
        background.clear();
        background.beginFill("#0b1224");
        background.drawRect(0, 0, width, height);
        background.endFill();
        label.position.set(width / 2, height / 2);
      };

      app.stage.addChild(background, label);
      layout();
    };

    boot();
    window.addEventListener("resize", onResize);

    return () => {
      disposed = true;
      window.removeEventListener("resize", onResize);

      const canvas = canvasRef.current;
      if (mount && canvas && mount.contains(canvas)) {
        try {
          mount.removeChild(canvas);
        } catch {
          // ignore removal errors
        }
      }

      if (app) {
        try {
          app.destroy(true);
        } catch {
          // ignore destroy errors
        }
        app = null;
      }

      appRef.current = null;
      canvasRef.current = null;
    };
  }, []);

  return <div ref={mountRef} style={{ width: "100vw", height: "100vh" }} />;
}
