"use client";

import { useEffect, useRef } from "react";
import { Application, Graphics, Text } from "pixi.js";

export default function AfkMapPage() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const appRef = useRef<Application | null>(null);

  useEffect(() => {
    let disposed = false;
    let resizeBound = false;
    const mount = mountRef.current;
    if (!mount) return undefined;

    appRef.current = new Application();
    const app = appRef.current;

    const background = new Graphics();
    const label = new Text("AFK MAP", {
      fill: "#e8ecf4",
      fontSize: 48,
      fontWeight: "800",
      fontFamily: "Inter, sans-serif",
    });
    label.anchor.set(0.5);

    const layout = () => {
      const currentApp = appRef.current;
      if (!currentApp) return;
      const width = mount.clientWidth || window.innerWidth || 360;
      const height = mount.clientHeight || window.innerHeight || 640;
      currentApp.renderer.resize(width, height);
      background.clear();
      background.beginFill("#0b1224");
      background.drawRect(0, 0, width, height);
      background.endFill();
      label.position.set(width / 2, height / 2);
    };

    const boot = async () => {
      const currentApp = appRef.current;
      if (!currentApp) return;
      await currentApp.init({
        width: mount.clientWidth || window.innerWidth || 360,
        height: mount.clientHeight || window.innerHeight || 640,
        background: "#0b1224",
        antialias: true,
      });
      if (disposed) {
        currentApp.destroy(true);
        appRef.current = null;
        return;
      }
      mount.innerHTML = "";
      mount.appendChild(currentApp.canvas);
      currentApp.stage.addChild(background, label);
      layout();
    };

    boot();
    const onResize = () => layout();
    window.addEventListener("resize", onResize);
    resizeBound = true;

    return () => {
      disposed = true;
      if (resizeBound) {
        window.removeEventListener("resize", onResize);
      }
      if (appRef.current) {
        if (mount.contains(appRef.current.canvas)) {
          mount.removeChild(appRef.current.canvas);
        }
        appRef.current.destroy(true);
        appRef.current = null;
      }
    };
  }, []);

  return (
    <div
      ref={mountRef}
      style={{
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
        display: "flex",
        alignItems: "stretch",
        justifyContent: "center",
      }}
    />
  );
}
