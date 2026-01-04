"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Application } from "pixi.js";
import { generateCampaignGraph, CampaignNode } from "@ai-studio/core";
import { MapRenderer } from "@ai-studio/render-pixi";

export default function AfkMapPage() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const appRef = useRef<Application | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mapRendererRef = useRef<MapRenderer | null>(null);
  const initialSelectedRef = useRef<string | null>(null);

  const graph = useMemo(() => generateCampaignGraph({ seed: 12345, chaptersCount: 8, nodesPerChapter: 10 }), []);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(graph.startNodeId);
  initialSelectedRef.current = initialSelectedRef.current ?? graph.startNodeId;

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    let app: Application | null = null;
    let disposed = false;
    let layout: () => void = () => {};
    let lastY: number | null = null;

    const onResize = () => layout();

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
      if (!view) throw new Error("Pixi canvas/view not available after init");
      canvasRef.current = view;
      mount.appendChild(view);

      const mapRenderer = new MapRenderer(createdApp, graph, {
        nodeRadius: 18,
        chapterSpacing: 190,
        nodeSpacing: 90,
        padding: 64,
        horizontalSpread: 110,
      });
      mapRendererRef.current = mapRenderer;
      mapRenderer.setSelectedId(initialSelectedRef.current);
      mapRenderer.render();

      layout = () => {
        if (disposed || !app) return;
        const width = mount.clientWidth || window.innerWidth;
        const height = mount.clientHeight || window.innerHeight;
        app.renderer.resize(width, height);
        mapRenderer.render();
      };

      const onWheel = (event: WheelEvent) => {
        if (!mapRenderer) return;
        mapRenderer.setScroll(mapRenderer.getScroll() - event.deltaY);
        mapRenderer.render();
      };

      const onPointerDown = (event: PointerEvent) => {
        lastY = event.clientY;
        view.setPointerCapture(event.pointerId);
      };

      const onPointerMove = (event: PointerEvent) => {
        if (lastY === null || !mapRenderer) return;
        const delta = event.clientY - lastY;
        lastY = event.clientY;
        mapRenderer.setScroll(mapRenderer.getScroll() + delta);
        mapRenderer.render();
      };

      const endPointer = (event: PointerEvent) => {
        lastY = null;
        view.releasePointerCapture(event.pointerId);
      };

      view.addEventListener("wheel", onWheel, { passive: true });
      view.addEventListener("pointerdown", onPointerDown);
      view.addEventListener("pointermove", onPointerMove);
      view.addEventListener("pointerup", endPointer);
      view.addEventListener("pointercancel", endPointer);

      const onSelect = (node: CampaignNode) => {
        setSelectedNodeId(node.id);
        mapRenderer.setSelectedId(node.id);
        mapRenderer.render();
      };
      mapRenderer.onSelect(onSelect);

      window.addEventListener("resize", onResize);

      return () => {
        view.removeEventListener("wheel", onWheel);
        view.removeEventListener("pointerdown", onPointerDown);
        view.removeEventListener("pointermove", onPointerMove);
        view.removeEventListener("pointerup", endPointer);
        view.removeEventListener("pointercancel", endPointer);
      };
    };

    let cleanupViewListeners: (() => void) | void;
    boot().then((cleanup) => {
      cleanupViewListeners = cleanup;
    });
    window.addEventListener("resize", onResize);

    return () => {
      disposed = true;
      window.removeEventListener("resize", onResize);
      if (cleanupViewListeners) {
        try {
          cleanupViewListeners();
        } catch {
          // ignore
        }
      }

      const canvas = canvasRef.current;
      if (mount && canvas && mount.contains(canvas)) {
        try {
          mount.removeChild(canvas);
        } catch {
          // ignore removal errors
        }
      }

      if (mapRendererRef.current) {
        try {
          mapRendererRef.current.destroy();
        } catch {
          // ignore destroy errors
        }
        mapRendererRef.current = null;
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
  }, [graph]);

  useEffect(() => {
    const renderer = mapRendererRef.current;
    if (renderer) {
      renderer.setSelectedId(selectedNodeId);
      renderer.render();
    }
  }, [selectedNodeId]);

  const selectedNode = useMemo(() => {
    if (!selectedNodeId) return null;
    for (const chapter of graph.chapters) {
      const found = chapter.nodes.find((n) => n.id === selectedNodeId);
      if (found) return found;
    }
    return null;
  }, [graph.chapters, selectedNodeId]);

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", background: "#0b1224" }}>
      <div ref={mountRef} style={{ flex: 1, width: "100%", height: "70vh", overflow: "hidden" }} />
      <div
        style={{
          padding: "12px 16px",
          background: "#0f172a",
          borderTop: "1px solid #1f2937",
          color: "#e2e8f0",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <p style={{ margin: 0, fontSize: 12, color: "#94a3b8", letterSpacing: "0.08em" }}>Nodo seleccionado</p>
            <h3 style={{ margin: "2px 0 0", fontSize: 18 }}>{selectedNode?.id ?? "Ninguno"}</h3>
            <p style={{ margin: 0, color: "#cbd5e1" }}>Tipo: {selectedNode?.type ?? "-"}</p>
          </div>
          <button
            type="button"
            disabled
            style={{
              padding: "10px 16px",
              background: "#1d4ed8",
              color: "#e2e8f0",
              border: "none",
              borderRadius: 10,
              opacity: 0.5,
              cursor: "not-allowed",
            }}
          >
            FIGHT
          </button>
        </div>
      </div>
    </div>
  );
}
