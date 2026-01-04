"use client";
/* eslint-disable react-hooks/exhaustive-deps */

import { useEffect, useMemo, useRef, useState } from "react";
import { Application } from "pixi.js";
import { useRouter } from "next/navigation";
import { generateCampaignGraph, CampaignNode } from "@ai-studio/core";
import { MapRenderer } from "@ai-studio/render-pixi";

type ProgressState = { currentNodeId: string; cleared: Record<string, true> };

export default function AfkMapPage() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const appRef = useRef<Application | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mapRendererRef = useRef<MapRenderer | null>(null);
  const initialSelectedRef = useRef<string | null>(null);
  const progressRef = useRef<ProgressState | null>(null);
  const router = useRouter();

  const graph = useMemo(() => generateCampaignGraph({ seed: 12345, chaptersCount: 8, nodesPerChapter: 10 }), []);
  const [progress, setProgress] = useState<ProgressState>(() => ({
    currentNodeId: graph.startNodeId,
    cleared: {},
  }));
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(graph.startNodeId);
  initialSelectedRef.current = initialSelectedRef.current ?? graph.startNodeId;
  const [queryNodeId, setQueryNodeId] = useState<string | null>(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  // eslint-disable-next-line react-hooks/exhaustive-deps
  // eslint-disable-next-line react-hooks/exhaustive-deps
  // eslint-disable-next-line react-hooks/exhaustive-deps
  // eslint-disable-next-line react-hooks/exhaustive-deps
  // eslint-disable-next-line react-hooks/exhaustive-deps
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const saved = loadProgress();
    if (saved) {
      setProgress(saved);
      setSelectedNodeId(saved.currentNodeId);
      initialSelectedRef.current = saved.currentNodeId;
    }
  }, []);

  useEffect(() => {
    saveProgress(progress);
    progressRef.current = progress;
  }, [progress]);

  useEffect(() => {
    progressRef.current = progress;
  }, [progress]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const paramNode = params.get("nodeId");
    if (paramNode) setQueryNodeId(paramNode);
  }, []);

  useEffect(() => {
    if (queryNodeId) {
      setSelectedNodeId(queryNodeId);
    }
  }, [queryNodeId]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    let app: Application | null = null;
    let disposed = false;
    let layout: () => void = () => {};
    let lastY: number | null = null;
    let viewCleanup: (() => void) | null = null;

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
      const initialProgress = progressRef.current ?? progress;
      mapRenderer.setProgress(initialProgress);
      mapRenderer.setSelectedNodeId(queryNodeId ?? initialSelectedRef.current);
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
        mapRenderer.setSelectedNodeId(node.id);
        mapRenderer.render();
      };
      mapRenderer.onSelect(onSelect);

      window.addEventListener("resize", onResize);

      viewCleanup = () => {
        view.removeEventListener("wheel", onWheel);
        view.removeEventListener("pointerdown", onPointerDown);
        view.removeEventListener("pointermove", onPointerMove);
        view.removeEventListener("pointerup", endPointer);
        view.removeEventListener("pointercancel", endPointer);
      };
    };

    boot();

    return () => {
      disposed = true;
      window.removeEventListener("resize", onResize);
      if (viewCleanup) {
        try {
          viewCleanup();
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
  }, [graph, queryNodeId]);

  useEffect(() => {
    const renderer = mapRendererRef.current;
    if (renderer) {
      renderer.setSelectedNodeId(selectedNodeId);
      renderer.setProgress(progress);
      renderer.render();
    }
  }, [selectedNodeId, progress]);

  const nodeOrder = useMemo(() => {
    const map = new Map<string, number>();
    graph.chapters.forEach((chapter) =>
      chapter.nodes.forEach((node, idx) => map.set(node.id, chapter.index * 1000 + idx))
    );
    return map;
  }, [graph.chapters]);

  const selectedNode = useMemo(() => {
    if (!selectedNodeId) return null;
    for (const chapter of graph.chapters) {
      const found = chapter.nodes.find((n) => n.id === selectedNodeId);
      if (found) return found;
    }
    return null;
  }, [graph.chapters, selectedNodeId]);

  const selectedState = useMemo<"locked" | "current" | "cleared">(() => {
    if (!selectedNode) return "locked";
    if (selectedNode.id === progress.currentNodeId) return "current";
    const order = nodeOrder.get(selectedNode.id) ?? 0;
    const currentOrder = nodeOrder.get(progress.currentNodeId) ?? 0;
    if (progress.cleared[selectedNode.id] || order < currentOrder) return "cleared";
    return "locked";
  }, [selectedNode, progress, nodeOrder]);

  const recommendedPower =
    selectedNode?.recommendedPower ?? Math.max(400, (nodeOrder.get(selectedNodeId ?? "") ?? 0) * 5 + 400);
  const rewards = selectedNode?.rewards ?? { gold: 50, exp: 45, items: [{ id: "mat", qty: 2 }] };

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
            <p style={{ margin: 0, color: "#cbd5e1" }}>Power recomendado: {recommendedPower}</p>
            <p style={{ margin: 0, color: "#cbd5e1" }}>
              Recompensas: oro {rewards.gold ?? 0} · exp {rewards.exp ?? 0}
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {selectedNode?.type === "treasure" && (
              <button
                type="button"
                disabled
                style={{
                  padding: "8px 12px",
                  background: "#10b981",
                  color: "#e2e8f0",
                  border: "none",
                  borderRadius: 8,
                  opacity: 0.6,
                  cursor: "not-allowed",
                }}
              >
                Claim
              </button>
            )}
            <button
              type="button"
              disabled={selectedState === "locked" || !selectedNodeId}
              onClick={() => {
                if (!selectedNodeId) return;
                router.push(`/afk/battle?nodeId=${encodeURIComponent(selectedNodeId)}&seed=${graph.seed}`);
              }}
              style={{
                padding: "10px 16px",
                background: selectedState === "locked" ? "#1f2a44" : "#1d4ed8",
                color: "#e2e8f0",
                border: "none",
                borderRadius: 10,
                opacity: selectedState === "locked" ? 0.5 : 1,
                cursor: selectedState === "locked" ? "not-allowed" : "pointer",
              }}
            >
              FIGHT
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function loadProgress(): ProgressState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("afk_progress_v1");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const currentNodeId = typeof parsed.currentNodeId === "string" ? parsed.currentNodeId : "";
    const cleared = typeof parsed.cleared === "object" && parsed.cleared ? parsed.cleared : {};
    return { currentNodeId: currentNodeId || "", cleared };
  } catch {
    return null;
  }
}

function saveProgress(state: ProgressState) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem("afk_progress_v1", JSON.stringify(state));
  } catch {
    // ignore
  }
}
