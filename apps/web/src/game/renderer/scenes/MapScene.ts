import type PhaserLib from "phaser";

import { getCampaignProgress } from "../adapters/mapAdapter";

type PhaserModule = typeof import("phaser");

type MapSceneOptions = {
  onBattle?: () => void;
};

type MapNode = {
  id: string;
  x: number;
  y: number;
  power?: number;
};

type MapProgress = {
  chapterLabel: string;
  currentStageId: string;
  completedStageIds: string[];
  nodes: MapNode[];
};

type NodeView = {
  id: string;
  container: PhaserLib.GameObjects.Container;
  ring: PhaserLib.GameObjects.Arc;
  core: PhaserLib.GameObjects.Arc;
  label: PhaserLib.GameObjects.Text;
  stateLabel: PhaserLib.GameObjects.Text;
  pulse?: PhaserLib.GameObjects.Arc;
  state: "locked" | "current" | "completed";
};

type FogBlob = {
  shape: PhaserLib.GameObjects.Arc;
  vx: number;
  vy: number;
};

const MAP_WIDTH = 1100;
const MAP_HEIGHT = 580;

const COLORS = {
  locked: 0x334155,
  ready: 0x67e8f9,
  current: 0xfbbf24,
  completed: 0x14b8a6,
  base: 0x0b1627,
  pathDim: 0x22304a,
  pathBright: 0x67e8f9,
};

function clamp(min: number, max: number, value: number) {
  return Math.min(max, Math.max(min, value));
}

function computeSafeArea(width: number, height: number) {
  const topSafe = clamp(70, 110, Math.round(height * 0.12));
  const bottomSafe = clamp(100, 160, Math.round(height * 0.2));
  const sideSafe = clamp(90, 140, Math.round(width * 0.12));
  return {
    x: sideSafe,
    y: topSafe,
    width: Math.max(240, width - sideSafe * 2),
    height: Math.max(240, height - topSafe - bottomSafe),
  };
}

export function createMapScene(Phaser: PhaserModule, options: MapSceneOptions = {}) {
  return class MapScene extends Phaser.Scene {
    private progress: MapProgress | null = null;
    private mapContainer!: PhaserLib.GameObjects.Container;
    private nodes = new Map<string, NodeView>();
    private fogs: FogBlob[] = [];
    private partyMarker?: PhaserLib.GameObjects.Container;
    private partyTarget?: PhaserLib.Math.Vector2;
    private chapterText?: PhaserLib.GameObjects.Text;
    private toast?: PhaserLib.GameObjects.Text;
    private toastTimer?: PhaserLib.Time.TimerEvent;
    private safeArea = { x: 0, y: 0, width: 0, height: 0 };
    private debugBounds?: PhaserLib.GameObjects.Rectangle;

    create() {
      this.createBackground();
      this.createFog();
      this.mapContainer = this.add.container(0, 0);
      this.chapterText = this.add.text(18, 16, "Campaign", {
        fontFamily: "Chakra Petch, sans-serif",
        fontSize: "18px",
        color: "#e2e8f0",
      });
      this.toast = this.add.text(0, 0, "", {
        fontFamily: "Chakra Petch, sans-serif",
        fontSize: "14px",
        color: "#fef3c7",
        backgroundColor: "rgba(15, 23, 42, 0.8)",
        padding: { left: 8, right: 8, top: 4, bottom: 4 },
      });
      this.toast.setVisible(false);
      this.toast.setDepth(30);

      this.loadMap();

      this.scale.on("resize", (size: PhaserLib.Structs.Size) => {
        this.layout(size.width, size.height);
      });
    }

    private async loadMap() {
      const progress = await getCampaignProgress();
      if (!progress) {
        this.showEmpty();
        return;
      }
      this.progress = progress;
      this.chapterText?.setText(progress.chapterLabel);
      this.buildMap(progress);
      this.layout(this.scale.width, this.scale.height);
    }

    private showEmpty() {
      this.add.text(this.scale.width / 2, this.scale.height / 2, "No map data", {
        fontFamily: "Space Grotesk, sans-serif",
        fontSize: "20px",
        color: "#e2e8f0",
      }).setOrigin(0.5);
    }

    private createBackground() {
      const { width, height } = this.scale;
      this.add.rectangle(0, 0, width, height, 0x0b1222, 1).setOrigin(0, 0);
      this.add.rectangle(0, 0, width, height * 0.55, 0x0f1c34, 0.45).setOrigin(0, 0);
      this.add.rectangle(0, height * 0.55, width, height * 0.45, 0x0a1222, 0.6).setOrigin(0, 0);
    }

    private createFog() {
      const { width, height } = this.scale;
      for (let i = 0; i < 5; i += 1) {
        const blob = this.add.circle(
          Math.random() * width,
          Math.random() * height,
          80 + Math.random() * 60,
          0x7dd3fc,
          0.04
        );
        blob.setDepth(1);
        this.fogs.push({
          shape: blob,
          vx: 4 + Math.random() * 8,
          vy: 2 + Math.random() * 4,
        });
      }
    }

    private buildMap(progress: MapProgress) {
      this.mapContainer.removeAll(true);
      this.nodes.clear();

      const completed = new Set(progress.completedStageIds);
      const currentId = progress.currentStageId;
      const nodes = progress.nodes;
      const currentIndex = nodes.findIndex((node) => node.id === currentId);

      const path = this.add.graphics();
      path.setDepth(2);

      for (let i = 0; i < nodes.length - 1; i += 1) {
        const a = nodes[i];
        const b = nodes[i + 1];
        const isActive = i <= currentIndex;
        path.lineStyle(isActive ? 6 : 4, isActive ? COLORS.pathBright : COLORS.pathDim, isActive ? 0.5 : 0.3);
        path.beginPath();
        path.moveTo(a.x, a.y);
        path.lineTo(b.x, b.y);
        path.strokePath();
      }

      this.mapContainer.add(path);

      nodes.forEach((node) => {
        const state: NodeView["state"] = node.id === currentId ? "current" : completed.has(node.id) ? "completed" : "locked";
        const view = this.createNode(node, state, currentId);
        this.nodes.set(node.id, view);
        this.mapContainer.add(view.container);
      });

      const currentNode = nodes.find((node) => node.id === currentId) ?? nodes[0];
      this.partyMarker = this.createPartyMarker(currentNode.x, currentNode.y - 34);
      this.partyTarget = new Phaser.Math.Vector2(currentNode.x, currentNode.y - 34);
      this.mapContainer.add(this.partyMarker);
    }

    private createNode(node: MapNode, state: NodeView["state"], currentId: string): NodeView {
      const container = this.add.container(node.x, node.y);

      const hit = this.add.circle(0, 0, 46, 0x000000, 0.001);
      hit.setInteractive(new Phaser.Geom.Circle(0, 0, 46), Phaser.Geom.Circle.Contains);
      hit.on("pointerdown", () => {
        if (node.id === currentId) {
          options.onBattle?.();
        } else if (state === "locked") {
          this.showToast("Locked");
        }
      });

      const ring = this.add.circle(0, 0, 32, COLORS.base, 0.95);
      ring.setStrokeStyle(3, this.stateColor(state), state === "locked" ? 0.4 : 0.8);

      const core = this.add.circle(0, 0, 24, COLORS.base, 1);

      const label = this.add.text(0, -4, node.id, {
        fontFamily: "Chakra Petch, sans-serif",
        fontSize: "13px",
        color: "#e5e7eb",
      });
      label.setOrigin(0.5);

      const stateLabel = this.add.text(0, 12, state, {
        fontFamily: "Chakra Petch, sans-serif",
        fontSize: "10px",
        color: "#cbd5f5",
      });
      stateLabel.setOrigin(0.5);

      const markers = this.add.container(0, 40);
      const colors = [0xfbbf24, 0x22d3ee, 0xa855f7];
      colors.forEach((color, idx) => {
        const dot = this.add.circle(-10 + idx * 10, 0, 4, color, 0.9);
        markers.add(dot);
      });

      container.add([hit, ring, core, label, stateLabel, markers]);
      container.setScale(1);

      let pulse: PhaserLib.GameObjects.Arc | undefined;
      if (state === "current") {
        pulse = this.add.circle(0, 0, 38, 0x000000, 0);
        pulse.setStrokeStyle(2, COLORS.current, 0.8);
        container.add(pulse);
        this.tweens.add({
          targets: pulse,
          scale: 1.25,
          alpha: 0,
          duration: 1200,
          repeat: -1,
        });
      } else if (state === "completed") {
        ring.setStrokeStyle(3, COLORS.completed, 0.8);
      } else if (state === "locked") {
        container.setAlpha(0.55);
      }

      return { id: node.id, container, ring, core, label, stateLabel, pulse, state };
    }

    private createPartyMarker(x: number, y: number) {
      const marker = this.add.container(x, y);
      const diamond = this.add.graphics();
      diamond.fillStyle(0x7ce4ff, 0.9);
      diamond.fillPoints(
        [
          { x: 0, y: -10 },
          { x: 8, y: 0 },
          { x: 0, y: 10 },
          { x: -8, y: 0 },
        ],
        true
      );
      marker.add(diamond);
      marker.setDepth(5);
      return marker;
    }

    private stateColor(state: NodeView["state"]) {
      if (state === "current") return COLORS.current;
      if (state === "completed") return COLORS.completed;
      return COLORS.locked;
    }

    private showToast(message: string) {
      if (!this.toast) return;
      this.toast.setText(message);
      this.toast.setAlpha(1);
      this.toast.setVisible(true);
      this.toastTimer?.destroy();
      this.toastTimer = this.time.delayedCall(900, () => {
        this.toast?.setVisible(false);
      });
    }

    private layout(width: number, height: number) {
      this.safeArea = computeSafeArea(width, height);

      if (this.chapterText) {
        this.chapterText.setPosition(this.safeArea.x, 16);
      }

      if (this.toast) {
        this.toast.setPosition(this.safeArea.x, this.safeArea.y + this.safeArea.height + 16);
      }

      if (this.debugBounds) {
        this.debugBounds.destroy();
        this.debugBounds = undefined;
      }

      const scale = Math.min(
        this.safeArea.width / MAP_WIDTH,
        this.safeArea.height / MAP_HEIGHT
      );
      const mapWidthScaled = MAP_WIDTH * scale;
      const mapHeightScaled = MAP_HEIGHT * scale;
      const offsetX = this.safeArea.x + (this.safeArea.width - mapWidthScaled) / 2;
      const offsetY = this.safeArea.y + (this.safeArea.height - mapHeightScaled) / 2;

      this.mapContainer.setScale(scale);
      this.mapContainer.setPosition(offsetX, offsetY);
    }

    update(_time: number, delta: number) {
      const { width, height } = this.scale;
      const dt = delta / 1000;

      this.fogs.forEach((fog) => {
        fog.shape.x += fog.vx * dt;
        fog.shape.y += fog.vy * dt;
        if (fog.shape.x > width + 120) fog.shape.x = -120;
        if (fog.shape.y > height + 120) fog.shape.y = -120;
      });

      if (this.partyMarker && this.partyTarget) {
        const target = this.partyTarget;
        const current = this.partyMarker;
        const speed = 0.02;
        current.x += (target.x - current.x) * speed;
        current.y += (target.y - current.y) * speed;
        current.y += Math.sin(this.time.now * 0.002) * 0.6;
      }
    }
  };
}
