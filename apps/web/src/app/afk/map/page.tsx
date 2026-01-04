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

    app = new Application({
      width: mount.clientWidth || window.innerWidth || 360,
      height: mount.clientHeight || window.innerHeight || 640,
      backgroundAlpha: 0,
      antialias: true,
    });
    appRef.current = app;

    const view = app.view as HTMLCanvasElement;
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

    const layout = () => {
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

    const onResize = () => {
      layout();
    };
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
