import type PhaserLib from "phaser";
import {
  CampaignMapRuntimeBus,
  type CampaignMapRuntime,
  type CampaignStageRuntimeState,
} from "@/game/renderer/utils/CampaignMapRuntimeBus";

type PhaserModule = typeof import("phaser");

type CampaignStageLayout = {
  id: string;
  recommendedPower?: number;
};

type CampaignMapOptions = {
  layoutStages: CampaignStageLayout[];
  runtimeBus?: CampaignMapRuntimeBus;
  onSelectStage?: (stageId: string) => void;
};

type NodeView = {
  id: string;
  container: PhaserLib.GameObjects.Container;
  ring: PhaserLib.GameObjects.Arc;
  core: PhaserLib.GameObjects.Arc;
  label: PhaserLib.GameObjects.Text;
  state: CampaignStageRuntimeState | "current";
};

type Bounds = { minX: number; minY: number; maxX: number; maxY: number };

const COLORS = {
  bg1: 0x0b1222,
  bg2: 0x0f1c34,
  bg3: 0x0a1222,
  base: 0x0b1627,
  pathBright: 0x67e8f9,
  locked: 0x334155,
  ready: 0x67e8f9,
  current: 0xfbbf24,
  completed: 0x22d3ee,
  text: "#e5e7eb",
  muted: "#94a3b8",
};

const NODE_RADIUS = 28;
const NODE_RING = NODE_RADIUS + 10;
const MIN_ZOOM = 0.6;
const MAX_ZOOM = 1.4;
let sceneInstanceCounter = 0;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function computeNodePositions(stages: CampaignStageLayout[]): Array<CampaignStageLayout & { x: number; y: number }> {
  const perRow = 4;
  const spacingX = 200;
  const spacingY = 140;
  const baseX = 140;
  const baseY = 140;
  return stages.map((stage, index) => {
    const col = index % perRow;
    const row = Math.floor(index / perRow);
    const stagger = row % 2 === 0 ? 0 : spacingX * 0.35;
    const x = baseX + col * spacingX + stagger;
    const y = baseY + row * spacingY;
    return { ...stage, x, y };
  });
}

export function createCampaignMapScene(Phaser: PhaserModule, options: CampaignMapOptions) {
  return class CampaignMapScene extends Phaser.Scene {
    private nodes = new Map<string, NodeView>();
    private nodeLayer!: PhaserLib.GameObjects.Container;
    private dragState: { active: boolean; lastX: number; lastY: number } = { active: false, lastX: 0, lastY: 0 };
    private bounds: Bounds | null = null;
    private safeMargin = 32;
    private backgrounds: PhaserLib.GameObjects.Rectangle[] = [];
    private lastValidSize: { width: number; height: number } | null = null;
    private lastInvalidWarn = 0;
    private lastFittedSize: { width: number; height: number } | null = null;
    private lastFittedBounds: Bounds | null = null;
    private hasFittedOnce = false;
    private pendingInitialFit: PhaserLib.Time.TimerEvent | null = null;
    private debugFit = false;
    private debugMap = false;
    private runtimeBus: CampaignMapRuntimeBus | null = null;
    private runtimeUnsubscribe: (() => void) | null = null;
    private runtimeSnapshot: CampaignMapRuntime | null = null;
    private sceneInstanceId: number;

    constructor() {
      super("campaign-map");
      sceneInstanceCounter += 1;
      this.sceneInstanceId = sceneInstanceCounter;
    }

    init() {
      if (typeof window === "undefined") return;
      const debugMap = window.localStorage?.getItem("afkDebugMap") === "1";
      const debugFit = window.localStorage?.getItem("afkDebugMapFit") === "1";
      this.debugMap = debugMap;
      this.debugFit = debugMap || debugFit;
      if (this.debugMap) {
        console.debug(`[CampaignMapScene#${this.sceneInstanceId}] init t=${Date.now()}`);
      }
    }

    create() {
      const cam = this.cameras.main;
      cam.setBackgroundColor(COLORS.bg1);
      if (this.debugMap) {
        console.debug(`[CampaignMapScene#${this.sceneInstanceId}] create t=${Date.now()}`);
      }
      this.nodeLayer = this.add.container(0, 0);
      this.runtimeBus = options.runtimeBus ?? null;
      this.runtimeSnapshot = this.runtimeBus?.getSnapshot() ?? null;

      this.createBackground();
      this.buildNodes();
      this.scheduleInitialFit();
      this.setupInput();

      this.scale.on("resize", this.handleResize, this);
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        this.scale.off("resize", this.handleResize, this);
        this.input.off("pointerdown");
        this.input.off("pointerup");
        this.input.off("pointerupoutside");
        this.input.off("pointermove");
        this.input.off("wheel");
        this.pendingInitialFit?.remove(false);
        this.pendingInitialFit = null;
        if (this.runtimeUnsubscribe) {
          this.runtimeUnsubscribe();
          this.runtimeUnsubscribe = null;
        }
        if (this.debugMap) {
          console.debug(`[CampaignMapScene#${this.sceneInstanceId}] shutdown t=${Date.now()}`);
        }
      });

      if (this.runtimeBus) {
        this.runtimeUnsubscribe = this.runtimeBus.subscribe((runtime) => {
          this.runtimeSnapshot = runtime;
          this.applyRuntime(runtime);
        });
      }
    }

    private createBackground() {
      const { width, height } = this.scale;
      const bg1 = this.add.rectangle(0, 0, width, height, COLORS.bg1, 1).setOrigin(0, 0);
      const bg2 = this.add.rectangle(0, 0, width, height * 0.55, COLORS.bg2, 0.5).setOrigin(0, 0);
      const bg3 = this.add.rectangle(0, height * 0.5, width, height * 0.5, COLORS.bg3, 0.65).setOrigin(0, 0);
      this.nodeLayer.addAt(bg1, 0);
      this.nodeLayer.addAt(bg2, 1);
      this.nodeLayer.addAt(bg3, 2);
      this.backgrounds = [bg1, bg2, bg3];
    }

    private buildNodes() {
      this.nodes.forEach((node) => node.container.destroy());
      this.nodes.clear();

      const stagesWithPos = computeNodePositions(options.layoutStages ?? []);
      const graphBounds = stagesWithPos.reduce<Bounds | null>((acc, stage) => {
        const minX = acc ? Math.min(acc.minX, stage.x - NODE_RING) : stage.x - NODE_RING;
        const maxX = acc ? Math.max(acc.maxX, stage.x + NODE_RING) : stage.x + NODE_RING;
        const minY = acc ? Math.min(acc.minY, stage.y - NODE_RING) : stage.y - NODE_RING;
        const maxY = acc ? Math.max(acc.maxY, stage.y + NODE_RING) : stage.y + NODE_RING;
        return { minX, maxX, minY, maxY };
      }, null);
      this.bounds = graphBounds;

      const currentId = this.runtimeSnapshot?.currentStageId;
      const runtimeStates = this.runtimeSnapshot?.stageStates ?? {};
      stagesWithPos.forEach((stage, index) => {
        const runtimeState = runtimeStates[stage.id] ?? "locked";
        const state: NodeView["state"] = stage.id === currentId ? "current" : runtimeState;
        const container = this.add.container(stage.x, stage.y);
        container.setDepth(5 + index * 0.01);
        const ring = this.add.circle(0, 0, NODE_RING, COLORS.base, 0.08);
        ring.setStrokeStyle(2, COLORS.pathBright, state === "current" ? 0.6 : 0.25);
        const coreColor =
          state === "current" ? COLORS.current : state === "completed" ? COLORS.completed : state === "ready" ? COLORS.ready : COLORS.locked;
        const core = this.add.circle(0, 0, NODE_RADIUS, coreColor, 0.92);
        core.setStrokeStyle(3, COLORS.bg1, 0.6);
        const label = this.add.text(0, NODE_RADIUS + 18, `Stage ${stage.id}`, {
          fontFamily: "Chakra Petch, sans-serif",
          fontSize: "13px",
          color: COLORS.text,
          align: "center",
        });
        label.setOrigin(0.5, 0);
        label.setWordWrapWidth(160, true);
        container.add([ring, core, label]);
        container.setSize(NODE_RING * 2, NODE_RING * 2);
        container.setInteractive(new Phaser.Geom.Circle(0, 0, NODE_RING), Phaser.Geom.Circle.Contains);
        container.on("pointerup", () => {
          options.onSelectStage?.(stage.id);
        });
        this.nodeLayer.add(container);
        this.nodes.set(stage.id, { id: stage.id, container, ring, core, label, state });
      });

      this.drawLinks(stagesWithPos);
      if (this.hasFittedOnce) {
        this.fitCamera(undefined, undefined, "boundsChanged");
      }
    }

    private drawLinks(stages: Array<CampaignStageLayout & { x: number; y: number }>) {
      const g = this.add.graphics();
      g.lineStyle(2, 0x22304a, 0.4);
      for (let i = 0; i < stages.length - 1; i += 1) {
        const from = stages[i];
        const to = stages[i + 1];
        g.moveTo(from.x, from.y);
        g.lineTo(to.x, to.y);
      }
      g.strokePath();
      g.setDepth(1);
      this.nodeLayer.addAt(g, 3);
    }

    private isValidSize(size: { width: number; height: number } | null | undefined) {
      if (!size) return false;
      const { width, height } = size;
      return Number.isFinite(width) && Number.isFinite(height) && width > 1 && height > 1;
    }

    private getCurrentSize() {
      const { width, height } = this.scale;
      const size = { width, height };
      return this.isValidSize(size) ? size : null;
    }

    private areBoundsEqual(a: Bounds | null, b: Bounds | null) {
      if (!a && !b) return true;
      if (!a || !b) return false;
      return a.minX === b.minX && a.maxX === b.maxX && a.minY === b.minY && a.maxY === b.maxY;
    }

    private recordFit(size: { width: number; height: number }) {
      this.lastValidSize = size;
      this.lastFittedSize = size;
      this.lastFittedBounds = this.bounds
        ? { minX: this.bounds.minX, minY: this.bounds.minY, maxX: this.bounds.maxX, maxY: this.bounds.maxY }
        : null;
      this.hasFittedOnce = true;
    }

    private logFit(reason: string, sizeChanged: boolean, boundsChanged: boolean, size: { width: number; height: number }) {
      if (!this.debugFit) return;
      const parts = [`reason=${reason}`, `w=${size.width}`, `h=${size.height}`];
      if (sizeChanged) parts.push("sizeChanged");
      if (boundsChanged) parts.push("boundsChanged");
      console.info(`[CampaignMapScene#${this.sceneInstanceId}] fitCamera`, parts.join(" "));
    }

    private applyRuntime(runtime: CampaignMapRuntime) {
      if (!runtime) return;
      const currentId = runtime.currentStageId;
      const stageStates = runtime.stageStates ?? {};
      this.nodes.forEach((node) => {
        const baseState = stageStates[node.id] ?? "locked";
        const nextState: NodeView["state"] = node.id === currentId ? "current" : baseState;
        if (node.state === nextState) return;
        const coreColor =
          nextState === "current"
            ? COLORS.current
            : nextState === "completed"
            ? COLORS.completed
            : nextState === "ready"
            ? COLORS.ready
            : COLORS.locked;
        node.ring.setStrokeStyle(2, COLORS.pathBright, nextState === "current" ? 0.6 : 0.25);
        node.core.setFillStyle(coreColor, 0.92);
        node.state = nextState;
      });
      if (this.debugMap) {
        console.debug(
          `[CampaignMapScene#${this.sceneInstanceId}] runtime apply t=${Date.now()} current=${currentId ?? "-"}`
        );
      }
    }

    private scheduleInitialFit(delayMs = 0) {
      this.pendingInitialFit?.remove(false);
      this.pendingInitialFit = this.time.delayedCall(
        delayMs,
        () => {
          this.pendingInitialFit = null;
          this.attemptInitialFit();
        },
        undefined,
        this
      );
    }

    private attemptInitialFit() {
      if (this.hasFittedOnce) return;
      const size = this.getCurrentSize();
      if (!this.isValidSize(size)) {
        this.scheduleInitialFit(50);
        return;
      }
      this.fitCamera(size.width, size.height, "create");
      if (!this.hasFittedOnce) {
        this.scheduleInitialFit(50);
      }
    }

    private fitCamera(widthOverride?: number, heightOverride?: number, reason: "create" | "resize" | "boundsChanged" | string = "manual") {
      const cam = this.cameras.main;
      const width = widthOverride ?? cam.width;
      const height = heightOverride ?? cam.height;
      const size = { width, height };
      if (!this.isValidSize(size)) {
        return;
      }
      const boundsChanged = !this.areBoundsEqual(this.lastFittedBounds, this.bounds);
      const sizeChanged = !this.lastFittedSize || this.lastFittedSize.width !== width || this.lastFittedSize.height !== height;
      if (this.hasFittedOnce && !sizeChanged && !boundsChanged) {
        return;
      }
      if (!this.bounds) {
        cam.centerOn(0, 0);
        this.recordFit(size);
        this.logFit(reason, sizeChanged, boundsChanged, size);
        return;
      }
      this.safeMargin = clamp(Math.round(Math.min(width, height) * 0.08), 16, 64);
      const contentWidth = this.bounds.maxX - this.bounds.minX + this.safeMargin * 2;
      const contentHeight = this.bounds.maxY - this.bounds.minY + this.safeMargin * 2;
      const zoomX = width / contentWidth;
      const zoomY = height / contentHeight;
      const zoom = clamp(Math.min(zoomX, zoomY), MIN_ZOOM, MAX_ZOOM);
      cam.setZoom(zoom);
      const centerX = (this.bounds.minX + this.bounds.maxX) / 2;
      const centerY = (this.bounds.minY + this.bounds.maxY) / 2;
      cam.centerOn(centerX, centerY);
      const worldW = Math.max(width / zoom, contentWidth);
      const worldH = Math.max(height / zoom, contentHeight);
      const worldX = centerX - worldW / 2;
      const worldY = centerY - worldH / 2;
      cam.setBounds(worldX, worldY, worldW, worldH);
      if (this.backgrounds.length) {
        const bgX = this.bounds.minX - this.safeMargin * 2;
        const bgY = this.bounds.minY - this.safeMargin * 2;
        const bgW = this.bounds.maxX - this.bounds.minX + this.safeMargin * 4;
        const bgH = this.bounds.maxY - this.bounds.minY + this.safeMargin * 4;
        const [bg1, bg2, bg3] = this.backgrounds;
        bg1.setPosition(bgX, bgY);
        bg2.setPosition(bgX, bgY);
        bg3.setPosition(bgX, bgY + bgH * 0.5);
        bg1.setSize(bgW, bgH);
        bg2.setSize(bgW, bgH * 0.55);
        bg3.setSize(bgW, bgH * 0.5);
      }
      this.recordFit(size);
      this.logFit(reason, sizeChanged, boundsChanged, size);
    }

    private handleResize = (size: PhaserLib.Structs.Size) => {
      const { width, height } = size;
      const nextSize = { width, height };
      if (!this.isValidSize(nextSize)) {
        const now = Date.now();
        if ((this.debugMap || this.debugFit) && now - this.lastInvalidWarn >= 1000) {
          console.warn(`CampaignMapScene resize ignored due to invalid size (w=${width}, h=${height})`);
          this.lastInvalidWarn = now;
        }
        return;
      }
      const sizeChanged =
        !this.lastValidSize || this.lastValidSize.width !== nextSize.width || this.lastValidSize.height !== nextSize.height;
      if (!sizeChanged) return;
      this.lastValidSize = nextSize;
      if (this.backgrounds.length === 3) {
        const [bg1, bg2, bg3] = this.backgrounds;
        bg1.setSize(width, height);
        bg2.setSize(width, height * 0.55);
        bg3.setPosition(0, height * 0.5);
        bg3.setSize(width, height * 0.5);
      }
      this.fitCamera(width, height, "resize");
    };

    private setupInput() {
      this.input.on("pointerdown", (pointer: PhaserLib.Input.Pointer) => {
        this.dragState = { active: true, lastX: pointer.position.x, lastY: pointer.position.y };
      });
      const stopDrag = () => {
        this.dragState.active = false;
      };
      this.input.on("pointerup", stopDrag);
      this.input.on("pointerupoutside", stopDrag);

      this.input.on("pointermove", (pointer: PhaserLib.Input.Pointer) => {
        if (!this.dragState.active) return;
        const cam = this.cameras.main;
        const dx = (pointer.position.x - this.dragState.lastX) / cam.zoom;
        const dy = (pointer.position.y - this.dragState.lastY) / cam.zoom;
        cam.scrollX -= dx;
        cam.scrollY -= dy;
        this.dragState.lastX = pointer.position.x;
        this.dragState.lastY = pointer.position.y;
      });

      this.input.on(
        "wheel",
        (_pointer: PhaserLib.Input.Pointer, _gameObjects: PhaserLib.GameObjects.GameObject[], _dx: number, dy: number) => {
          const cam = this.cameras.main;
          const factor = dy > 0 ? 0.95 : 1.05;
          const nextZoom = clamp(cam.zoom * factor, MIN_ZOOM, MAX_ZOOM);
          cam.setZoom(nextZoom);
        }
      );
    }
  };
}
