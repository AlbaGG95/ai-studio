import { Application, Container, Graphics, Text } from "pixi.js";
import { CampaignGraph, CampaignNode, AfkNodeType as NodeType } from "@ai-studio/core";

export interface MapRenderOptions {
  nodeRadius?: number;
  chapterSpacing?: number;
  nodeSpacing?: number;
  padding?: number;
  horizontalSpread?: number;
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

export class MapRenderer {
  private readonly app: Application;
  private readonly graph: CampaignGraph;
  private readonly options: Required<MapRenderOptions>;
  private readonly container: Container;

  constructor(app: Application, graph: CampaignGraph, options: MapRenderOptions = {}) {
    this.app = app;
    this.graph = graph;
    this.options = {
      nodeRadius: options.nodeRadius ?? 12,
      chapterSpacing: options.chapterSpacing ?? 180,
      nodeSpacing: options.nodeSpacing ?? 90,
      padding: options.padding ?? 32,
      horizontalSpread: options.horizontalSpread ?? 80,
    };
    this.container = new Container();
    this.app.stage.addChild(this.container);
  }

  render() {
    this.container.removeChildren();
    const edgesGfx = new Graphics();
    const nodesGfx = new Graphics();
    const labelsLayer = new Container();

    const { width, height } = this.getViewport();
    const { padding, chapterSpacing, nodeSpacing, horizontalSpread, nodeRadius } = this.options;
    const centerX = width / 2;

    const positions = new Map<string, Point>();

    this.graph.chapters.forEach((chapter) => {
      const baseY = padding + chapter.index * chapterSpacing;
      chapter.nodes.forEach((node, idx) => {
        const noise = hashToUnit(`${this.graph.seed}-${node.id}`);
        const xOffset = (noise - 0.5) * 2 * horizontalSpread;
        const x = centerX + xOffset;
        const y = baseY + idx * nodeSpacing;
        positions.set(node.id, { x, y });
      });
    });

    this.graph.chapters.forEach((chapter) => {
      chapter.nodes.forEach((node) => {
        const from = positions.get(node.id);
        if (!from) return;
        node.edges.forEach((targetId) => {
          const to = positions.get(targetId);
          if (!to) return;
          edgesGfx.lineStyle(2, 0x475569, 0.7);
          edgesGfx.moveTo(from.x, from.y);
          edgesGfx.lineTo(to.x, to.y);
        });
      });
    });

    this.graph.chapters.forEach((chapter) => {
      chapter.nodes.forEach((node) => {
        const point = positions.get(node.id);
        if (!point) return;
        const color = TYPE_COLOR[node.type] ?? TYPE_COLOR.normal;
        nodesGfx.beginFill(color, 0.95);
        nodesGfx.lineStyle(2, 0x0f172a, 0.8);
        nodesGfx.drawCircle(point.x, point.y, nodeRadius);
        nodesGfx.endFill();

        const label = new Text(node.id, {
          fill: "#e2e8f0",
          fontSize: 10,
          fontWeight: "700",
          align: "center",
          fontFamily: "Inter, sans-serif",
        });
        label.anchor.set(0.5, -1.4);
        label.position.set(point.x, point.y);
        labelsLayer.addChild(label);
      });
    });

    const background = new Graphics();
    background.beginFill(0x0b1224);
    background.drawRect(0, 0, width, height);
    background.endFill();

    this.container.addChild(background, edgesGfx, nodesGfx, labelsLayer);
  }

  destroy() {
    this.container.removeChildren();
    this.container.destroy({ children: true });
  }

  private getViewport() {
    const renderer: any = this.app.renderer as any;
    const width = renderer?.width ?? renderer?.screen?.width ?? 800;
    const height = renderer?.height ?? renderer?.screen?.height ?? 600;
    return { width, height };
  }
}
