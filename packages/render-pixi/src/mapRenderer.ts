import { Application, Container, Graphics } from "pixi.js";
import { CampaignGraph, CampaignNode, AfkNodeType as NodeType } from "@ai-studio/core";

export interface MapRenderOptions {
  nodeRadius?: number;
  chapterSpacing?: number;
  nodeSpacing?: number;
  padding?: number;
  horizontalSpread?: number;
  paddingTop?: number;
}

type Point = { x: number; y: number };

const TYPE_COLOR: Record<NodeType, number> = {
  normal: 0x3b82f6,
  elite: 0xa855f7,
  boss: 0xef4444,
  treasure: 0xf59e0b,
};

function hashToUnit(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = Math.imul(31, hash) + input.charCodeAt(i);
  }
  return ((hash >>> 0) % 1000) / 999;
}

type NodeState = "locked" | "next" | "cleared" | "selected";

export class MapRenderer {
  private readonly app: Application;
  private readonly graph: CampaignGraph;
  private readonly options: Required<MapRenderOptions>;
  private readonly root: Container;
  private readonly world: Container;
  private cameraY = 0;
  private minScroll = 0;
  private maxScroll = 0;
  private selectedId: string | null = null;
  private selectCb: ((node: CampaignNode) => void) | null = null;

  constructor(app: Application, graph: CampaignGraph, options: MapRenderOptions = {}) {
    this.app = app;
    this.graph = graph;
    this.options = {
      nodeRadius: options.nodeRadius ?? 18,
      chapterSpacing: options.chapterSpacing ?? 190,
      nodeSpacing: options.nodeSpacing ?? 90,
      padding: options.padding ?? 32,
      horizontalSpread: options.horizontalSpread ?? 110,
      paddingTop: options.paddingTop ?? 80,
    };
    this.root = new Container();
    this.world = new Container();
    this.app.stage.addChild(this.root);
    this.root.addChild(this.world);
  }

  setSelectedId(id: string | null) {
    this.selectedId = id;
  }

  onSelect(cb: (node: CampaignNode) => void) {
    this.selectCb = cb;
  }

  setScroll(y: number) {
    this.cameraY = Math.max(this.minScroll, Math.min(this.maxScroll, y));
    this.updateWorldPosition();
  }

  getScroll() {
    return this.cameraY;
  }

  render() {
    this.world.removeChildren();
    const edgesGlow = new Graphics();
    const edges = new Graphics();
    const nodesLayer = new Container();

    const { width, height } = this.getViewport();
    const { padding, chapterSpacing, nodeSpacing, horizontalSpread, nodeRadius, paddingTop } = this.options;
    const centerX = width / 2;

    this.world.position.set(centerX, paddingTop + this.cameraY);

    const positions = new Map<string, Point>();
    let contentMaxY = 0;

    this.graph.chapters.forEach((chapter) => {
      const baseY = chapter.index * chapterSpacing;
      chapter.nodes.forEach((node, idx) => {
        const noise = hashToUnit(`${this.graph.seed}-${node.id}`);
        const xOffset = (noise - 0.5) * 2 * horizontalSpread;
        const x = xOffset;
        const y = baseY + idx * nodeSpacing;
        positions.set(node.id, { x, y });
        contentMaxY = Math.max(contentMaxY, y + nodeRadius + padding);
      });
    });

    const startParts = this.graph.startNodeId.split("_");
    const startChapterIdx = Number(startParts[0]?.replace(/[^\d]/g, "") || 0);
    const startNodeIdx = Number(startParts[1]?.replace(/[^\d]/g, "") || 0);

    const background = new Graphics();
    background.beginFill(0x0b1224);
    background.drawRect(-width / 2, -paddingTop, width, height + paddingTop + Math.abs(this.minScroll));
    background.endFill();

    const drawEdge = (from: Point, to: Point) => {
      const ctrlX = (from.x + to.x) / 2 + (from.x - to.x) * 0.1;
      const ctrlY = (from.y + to.y) / 2 - 40;
      edgesGlow.lineStyle(7, 0x94a3b8, 0.16);
      edgesGlow.moveTo(from.x, from.y);
      edgesGlow.quadraticCurveTo(ctrlX, ctrlY, to.x, to.y);
      edges.lineStyle(4, 0x475569, 0.45);
      edges.moveTo(from.x, from.y);
      edges.quadraticCurveTo(ctrlX, ctrlY, to.x, to.y);
    };

    this.graph.chapters.forEach((chapter) => {
      chapter.nodes.forEach((node) => {
        const from = positions.get(node.id);
        if (!from) return;
        node.edges.forEach((targetId) => {
          const to = positions.get(targetId);
          if (!to) return;
          drawEdge(from, to);
        });
      });
    });

    this.graph.chapters.forEach((chapter) => {
      chapter.nodes.forEach((node, idx) => {
        const point = positions.get(node.id);
        if (!point) return;
        const state = this.resolveState(node, chapter.index, idx, startChapterIdx, startNodeIdx);
        const nodeContainer = new Container();
        nodeContainer.position.set(point.x, point.y);
        nodeContainer.eventMode = "static";
        nodeContainer.cursor = "pointer";
        nodeContainer.on("pointertap", () => {
          const select = this.selectCb;
          if (select) select(node);
        });

        const color = TYPE_COLOR[node.type] ?? TYPE_COLOR.normal;
        const glow = new Graphics();
        glow.beginFill(color, state === "selected" ? 0.25 : 0.16);
        glow.drawCircle(0, 0, nodeRadius + 10);
        glow.endFill();

        const circle = new Graphics();
        circle.beginFill(color, state === "locked" ? 0.45 : 0.95);
        circle.lineStyle(3, 0xe2e8f0, 0.9);
        circle.drawCircle(0, 0, nodeRadius);
        circle.endFill();

        const icon = this.drawIcon(node.type, color);

        const isSelected = state === "selected";
        const isLocked = state === "locked";
        const scale = isSelected ? 1.15 : isLocked ? 0.92 : 1;
        nodeContainer.scale.set(scale);
        nodeContainer.alpha = isLocked ? 0.65 : 1;

        nodeContainer.addChild(glow, circle, icon);
        nodesLayer.addChild(nodeContainer);
      });
    });

    this.world.addChild(background, edgesGlow, edges, nodesLayer);

    const contentHeight = contentMaxY + paddingTop + padding;
    const viewHeight = height;
    this.maxScroll = 0;
    this.minScroll = Math.min(0, viewHeight - contentHeight);
    this.setScroll(this.cameraY);
  }

  destroy() {
    this.root.removeChildren();
    this.world.removeChildren();
    this.root.destroy({ children: true });
    this.world.destroy({ children: true });
  }

  private updateWorldPosition() {
    const { paddingTop } = this.options;
    const { width } = this.getViewport();
    this.world.position.set(width / 2, paddingTop + this.cameraY);
  }

  private resolveState(node: CampaignNode, chapterIdx: number, nodeIdx: number, startChapterIdx: number, startNodeIdx: number): NodeState {
    if (node.id === this.selectedId) return "selected";
    if (chapterIdx < startChapterIdx || (chapterIdx === startChapterIdx && nodeIdx < startNodeIdx)) return "cleared";
    if (node.id === this.graph.startNodeId) return "next";
    return "locked";
  }

  private drawIcon(type: NodeType, color: number) {
    const g = new Graphics();
    g.lineStyle(3, 0x0f172a, 0.9);
    g.beginFill(0xf8fafc, 0.9);
    if (type === "boss") {
      g.moveTo(-6, 6);
      g.lineTo(0, -8);
      g.lineTo(6, 6);
      g.closePath();
    } else if (type === "treasure") {
      g.drawPolygon([-6, 0, 0, -8, 6, 0, 0, 8]);
    } else if (type === "elite") {
      g.drawStar(0, 0, 4, 7, 3.2);
    } else {
      g.drawCircle(0, 0, 3);
    }
    g.endFill();
    g.tint = color;
    return g;
  }

  private getViewport() {
    const renderer: any = this.app.renderer as any;
    const width = renderer?.width ?? renderer?.screen?.width ?? 800;
    const height = renderer?.height ?? renderer?.screen?.height ?? 600;
    return { width, height };
  }
}
