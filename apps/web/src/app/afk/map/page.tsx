"use client";

import { useEffect, useRef } from "react";
import { Application } from "pixi.js";
import { generateCampaignGraph } from "@ai-studio/core";
import { MapRenderer } from "@ai-studio/render-pixi";

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
    let mapRenderer: MapRenderer | null = null;

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

      const graph = generateCampaignGraph({ seed: 12345, chaptersCount: 8, nodesPerChapter: 10 });
      mapRenderer = new MapRenderer(createdApp, graph, {
        nodeRadius: 12,
        chapterSpacing: 170,
        nodeSpacing: 80,
        padding: 32,
        horizontalSpread: 90,
      });

      layout = () => {
        if (disposed || !app) return;
        const width = mount.clientWidth || window.innerWidth;
        const height = mount.clientHeight || window.innerHeight;
        app.renderer.resize(width, height);
        mapRenderer?.render();
      };

      mapRenderer.render();
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

      if (mapRenderer) {
        try {
          mapRenderer.destroy();
        } catch {
          // ignore destroy errors
        }
        mapRenderer = null;
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
