import type PhaserLib from "phaser";

import { type CampaignViewModel, type CampaignStageView } from "../../campaign/campaignViewModel";
import { getCampaignViewModel } from "../adapters/mapAdapter";

type PhaserModule = typeof import("phaser");

type MapSceneOptions = {
  onBattle?: (stageId: string) => void;
  campaign?: CampaignViewModel | null;
};

type StageState = "locked" | "ready" | "completed";

type MapNode = {
  id: string;
  x: number;
  y: number;
  power?: number;
  state: StageState;
};

type MapProgress = {
  chapterLabel: string;
  currentStageId: string;
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
  breathe?: PhaserLib.Tweens.Tween;
  state: "locked" | "ready" | "current" | "completed";
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

const ENABLE_MAP_AMBIENCE = true;
const ENABLE_PATH_SHIMMER = true;
const ENABLE_NODE_BREATHING = true;
const DEBUG_MAP_BOUNDS = false;

function clamp(min: number, max: number, value: number) {
  return Math.min(max, Math.max(min, value));
}

function computeSafeArea(width: number, height: number) {
  const topSafe = clamp(70, 110, Math.round(height * 0.12));
  const bottomSafe = clamp(100, 160, Math.round(height * 0.2));
  const sideSafe = clamp(40, 140, Math.round(width * 0.12));
  return {
    x: sideSafe,
    y: topSafe,
    width: Math.max(240, width - sideSafe * 2),
    height: Math.max(240, height - topSafe - bottomSafe),
  };
}

function computeStagePositions(stages: CampaignStageView[]) {
  const coords: Record<string, { x: number; y: number }> = {};
  stages.forEach((_stage, index) => {
    const col = index % 5;
    const row = Math.floor(index / 5);
    const baseX = 120 + col * 200 + (row % 2 === 0 ? 20 : -20);
    const baseY = 120 + row * 120;
    coords[_stage.id] = { x: baseX, y: baseY };
  });
  return coords;
}

function campaignToMapProgress(campaign: CampaignViewModel): MapProgress {
  const coords = computeStagePositions(campaign.stages);
  const nodes: MapNode[] = campaign.stages.map((stage) => {
    const pos = coords[stage.id] ?? { x: 0, y: 0 };
    return {
      id: stage.id,
      x: pos.x,
      y: pos.y,
      power: stage.recommendedPower,
      state: stage.state,
    };
  });

  return {
    chapterLabel: campaign.chapterLabel,
    currentStageId: campaign.currentStageId,
    nodes,
  };
}

export function createMapScene(Phaser: PhaserModule, options: MapSceneOptions = {}) {
  return class MapScene extends Phaser.Scene {
    private progress: MapProgress | null = null;
    private mapRoot!: PhaserLib.GameObjects.Container;
    private ambienceLayer!: PhaserLib.GameObjects.Container;
    private mapLayer!: PhaserLib.GameObjects.Container;
    private shimmerLayer!: PhaserLib.GameObjects.Graphics;
    private nodes = new Map<string, NodeView>();
    private fogs: FogBlob[] = [];
    private motes: FogBlob[] = [];
    private partyMarker?: PhaserLib.GameObjects.Container;
    private partyTarget?: PhaserLib.Math.Vector2;
  private chapterText?: PhaserLib.GameObjects.Text;
  private toast?: PhaserLib.GameObjects.Text;
  private toastTimer?: PhaserLib.Time.TimerEvent;
  private safeArea = { x: 0, y: 0, width: 0, height: 0 };
  private debugBounds?: PhaserLib.GameObjects.Rectangle;
  private graphBounds?: PhaserLib.Geom.Rectangle;
  private readonly DEBUG_MAP = false;
  private shimmerPhase = 0;

  create() {
    this.mapRoot = this.add.container(0, 0);
      this.ambienceLayer = this.add.container(0, 0);
      this.createBackground();
      this.createFog();
      this.mapLayer = this.add.container(0, 0);
      this.shimmerLayer = this.add.graphics();
      this.mapLayer.add(this.shimmerLayer);
      this.mapRoot.add(this.mapLayer);
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
      const campaign = options.campaign ?? (await getCampaignViewModel());
      if (!campaign) {
        this.showEmpty();
        return;
      }
      const progress = campaignToMapProgress(campaign);
      this.progress = progress;
      this.chapterText?.setText(progress.chapterLabel);
      this.buildMap(progress);
      this.graphBounds = this.mapLayer.getBounds();
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
      const bg1 = this.add.rectangle(0, 0, width, height, 0x0b1222, 1).setOrigin(0, 0);
      const bg2 = this.add.rectangle(0, 0, width, height * 0.55, 0x0f1c34, 0.45).setOrigin(0, 0);
      const bg3 = this.add.rectangle(0, height * 0.55, width, height * 0.45, 0x0a1222, 0.6).setOrigin(0, 0);
      this.mapRoot.add([bg1, bg2, bg3]);
      if (ENABLE_MAP_AMBIENCE) {
        this.ambienceLayer.add([bg1, bg2, bg3]);
        this.mapRoot.addAt(this.ambienceLayer, 0);
      }
    }

    private createFog() {
      const { width, height } = this.scale;
      if (!ENABLE_MAP_AMBIENCE) return;
      for (let i = 0; i < 3; i += 1) {
        const frac = (i + 1) / 4;
        const w = width * 0.8;
        const h = height * 0.18;
      const blob = this.add.rectangle(width * 0.1, height * (0.2 + frac * 0.2), w, h, 0x7dd3fc, 0.06 + i * 0.02);
      blob.setDepth(0.5);
      this.fogs.push({
        shape: blob,
        vx: (i + 1) * 3,
        vy: 0,
      });
      this.ambienceLayer.add(blob);
    }

    for (let i = 0; i < 6; i += 1) {
        const fracX = (i + 1) / 7;
        const fracY = (i * 2 + 3) / 14;
        const mote = this.add.circle(width * fracX, height * (0.2 + fracY * 0.6), 3, 0xffffff, 0.12 + (i % 3) * 0.03);
        mote.setDepth(0.6);
        this.motes.push({
          shape: mote,
          vx: 0,
          vy: -8 - i,
        });
        this.ambienceLayer.add(mote);
      }
    }

    private buildMap(progress: MapProgress) {
      this.mapLayer.removeAll(true);
      this.nodes.clear();
      this.shimmerLayer.clear();

      const currentId = progress.currentStageId;
      const nodes = progress.nodes;
      if (!nodes.length) return;
      const currentIndex = Math.max(0, nodes.findIndex((node) => node.id === currentId));

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

        if (ENABLE_PATH_SHIMMER && isActive) {
          this.shimmerLayer.lineStyle(2, COLORS.pathBright, 0.18);
          this.shimmerLayer.beginPath();
          this.shimmerLayer.moveTo(a.x, a.y);
          this.shimmerLayer.lineTo(b.x, b.y);
          this.shimmerLayer.strokePath();
        }
      }

      this.mapLayer.add(path);

      nodes.forEach((node) => {
        const nodeState: NodeView["state"] = node.id === currentId ? "current" : node.state;
        const view = this.createNode(node, nodeState);
        this.nodes.set(node.id, view);
        this.mapLayer.add(view.container);
      });

      const currentNode = nodes.find((node) => node.id === currentId) ?? nodes[0];
      this.partyMarker = this.createPartyMarker(currentNode.x, currentNode.y - 34);
      this.partyTarget = new Phaser.Math.Vector2(currentNode.x, currentNode.y - 34);
      this.mapLayer.add(this.partyMarker);
    }

    private createNode(node: MapNode, state: NodeView["state"]): NodeView {
      const container = this.add.container(node.x, node.y);

      const hit = this.add.circle(0, 0, 46, 0x000000, 0.001);
      hit.setInteractive(new Phaser.Geom.Circle(0, 0, 46), Phaser.Geom.Circle.Contains);
      hit.on("pointerdown", () => {
        if (state === "locked") {
          this.showToast("Locked");
          return;
        }
        options.onBattle?.(node.id);
      });

      const ring = this.add.circle(0, 0, 32, COLORS.base, 0.95);
      ring.setStrokeStyle(3, this.stateColor(state), state === "locked" ? 0.4 : 0.85);

      const core = this.add.circle(0, 0, 24, COLORS.base, 1);

      const label = this.add.text(0, -4, node.id, {
        fontFamily: "Chakra Petch, sans-serif",
        fontSize: "13px",
        color: "#e5e7eb",
      });
      label.setOrigin(0.5);

      const stateLabel = this.add.text(0, 12, state === "current" ? "current" : state, {
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
      if (state === "current" || state === "ready") {
        pulse = this.add.circle(0, 0, 38, 0x000000, 0);
        pulse.setStrokeStyle(2, COLORS.current, state === "current" ? 0.85 : 0.5);
        container.add(pulse);
        if (ENABLE_NODE_BREATHING) {
          const breathe = this.tweens.add({
            targets: pulse,
            scale: { from: 1, to: 1.08 },
            alpha: { from: 0.25, to: 0.45 },
            duration: 2800,
            yoyo: true,
            repeat: -1,
            ease: "Sine.easeInOut",
          });
          (pulse as any).__breathe = breathe;
        }
      } else if (state === "completed") {
        ring.setStrokeStyle(3, COLORS.completed, 0.8);
        const halo = this.add.circle(0, 0, 34, COLORS.completed, 0.12);
        container.add(halo);
      } else if (state === "locked") {
        container.setAlpha(0.55);
      } else if (state === "ready") {
        ring.setStrokeStyle(3, COLORS.ready, 0.8);
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
      if (state === "ready") return COLORS.ready;
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

      if (!this.graphBounds) return;

      const graphW = this.graphBounds.width;
      const graphH = this.graphBounds.height;
      const scale = clamp(
        0.8,
        1.4,
        Math.min(this.safeArea.width / graphW, this.safeArea.height / graphH) * 0.9
      );

      const offsetX =
        this.safeArea.x +
        this.safeArea.width / 2 -
        (this.graphBounds.x + this.graphBounds.width / 2) * scale;
      const offsetY =
        this.safeArea.y +
        this.safeArea.height / 2 -
        (this.graphBounds.y + this.graphBounds.height / 2) * scale;

      this.mapRoot.setScale(scale);
      this.mapRoot.setPosition(offsetX, offsetY);

      if (this.DEBUG_MAP) {
        this.debugBounds = this.add
          .rectangle(
            this.safeArea.x + this.safeArea.width / 2,
            this.safeArea.y + this.safeArea.height / 2,
            this.safeArea.width,
            this.safeArea.height,
            0xff00ff,
            0.08
          )
          .setOrigin(0.5);
        this.debugBounds.setStrokeStyle(1, 0xff00ff, 0.4);
      }
    }

    update(_time: number, delta: number) {
      const { width, height } = this.scale;
      const dt = delta / 1000;

      if (ENABLE_MAP_AMBIENCE) {
        this.fogs.forEach((fog, idx) => {
          fog.shape.x += fog.vx * dt * (idx % 2 === 0 ? 1 : -1);
          const wrapW = width + 200;
          if (fog.shape.x > width + 100) fog.shape.x = -100;
          if (fog.shape.x < -100) fog.shape.x = wrapW - 100;
        });

        this.motes.forEach((mote, idx) => {
          mote.shape.y += mote.vy * dt;
          mote.shape.x += Math.sin(this.time.now * 0.0012 + idx) * 4 * dt;
          if (mote.shape.y < -30) mote.shape.y = height + 30;
          if (mote.shape.y > height + 30) mote.shape.y = -30;
        });
      }

      if (this.partyMarker && this.partyTarget) {
        const target = this.partyTarget;
        const current = this.partyMarker;
        const speed = 0.02;
        current.x += (target.x - current.x) * speed;
        current.y += (target.y - current.y) * speed;
        current.y += Math.sin(this.time.now * 0.002) * 0.6;
      }

      if (ENABLE_PATH_SHIMMER) {
        this.shimmerPhase += dt;
        const alpha = 0.2 + 0.12 * Math.sin(this.shimmerPhase * 2);
        this.shimmerLayer.setAlpha(alpha);
      }
    }
  };
}
