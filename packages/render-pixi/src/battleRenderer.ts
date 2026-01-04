import { Application, Container, Graphics, Text } from "pixi.js";
import { CombatFrame, VisualDNA } from "@ai-studio/core";
import { ActiveFx, FloatingText, HitSpark, ScreenShake } from "./fx.js";
import { SlotPosition, TeamSide } from "./types.js";
import { UnitView } from "./unitView.js";

interface BattleRendererOptions {
  width: number;
  height: number;
  visuals?: Record<string, VisualDNA | undefined>;
}

export class BattleRenderer {
  private readonly app: Application;
  private readonly visuals: Record<string, VisualDNA | undefined>;
  private readonly layers: Record<"background" | "units" | "fx" | "ui", Container>;
  private readonly units = new Map<string, UnitView>();
  private readonly activeFx: ActiveFx[] = [];
  private readonly width: number;
  private readonly height: number;
  private readonly slotById = new Map<string, number>();
  private readonly teamById = new Map<string, TeamSide>();

  constructor(app: Application, options: BattleRendererOptions) {
    this.app = app;
    this.visuals = options.visuals ?? {};
    this.width = options.width;
    this.height = options.height;

    this.layers = {
      background: new Container(),
      units: new Container(),
      fx: new Container(),
      ui: new Container(),
    };
    this.app.stage.addChild(
      this.layers.background,
      this.layers.units,
      this.layers.fx,
      this.layers.ui
    );
    this.drawBackground();
  }

  destroy() {
    this.app.stage.removeChildren();
    this.units.clear();
    this.activeFx.splice(0);
    this.slotById.clear();
    this.teamById.clear();
  }

  private drawBackground() {
    const g = new Graphics();
    g.beginFill("#0b1224");
    g.drawRoundedRect(0, 0, this.width, this.height, 24);
    g.endFill();
    g.lineStyle(2, 0x22304a, 0.8);
    const midX = this.width / 2;
    g.moveTo(midX, 40);
    g.lineTo(midX, this.height - 40);
    for (let y = 80; y < this.height; y += 80) {
      g.moveTo(60, y);
      g.lineTo(this.width - 60, y);
    }
    this.layers.background.addChild(g);
  }

  private slotPositions(side: TeamSide): SlotPosition[] {
    const cx = this.width * 0.32;
    const cy = this.height * 0.5;
    const dx = 110;
    const dy = 90;
    const front = [
      { x: cx, y: cy - dy * 0.5 },
      { x: cx, y: cy + dy * 0.5 },
    ];
    const back = [
      { x: cx + dx, y: cy - dy },
      { x: cx + dx, y: cy },
      { x: cx + dx, y: cy + dy },
    ];
    const base = [...front, ...back];
    if (side === "enemy") {
      return base.map((p) => ({ x: this.width - p.x, y: p.y }));
    }
    return base;
  }

  private resolvePosition(unitId: string, side: TeamSide, lane: "front" | "back"): SlotPosition {
    const laneSlots = lane === "front" ? [0, 1] : [2, 3, 4];
    if (this.slotById.has(unitId)) {
      const idx = this.slotById.get(unitId) ?? laneSlots[0];
      return this.slotPositions(side)[idx] ?? { x: this.width / 2, y: this.height / 2 };
    }
    const used = new Set<number>();
    for (const [id, slotIdx] of this.slotById.entries()) {
      if (this.teamById.get(id) === side && laneSlots.includes(slotIdx)) {
        used.add(slotIdx);
      }
    }
    const slots = this.slotPositions(side);
    const slotIdx = laneSlots.find((idx) => !used.has(idx)) ?? laneSlots[0];
    this.slotById.set(unitId, slotIdx);
    this.teamById.set(unitId, side);
    return slots[slotIdx] ?? { x: this.width / 2, y: this.height / 2 };
  }

  bootstrap(frame: CombatFrame) {
    this.renderFrame(frame);
  }

  private upsertUnit(unit: CombatFrame["allies"][number], side: TeamSide) {
    const existing = this.units.get(unit.heroId);
    const position = this.resolvePosition(unit.heroId, side, unit.lane);
    if (!existing) {
      const view = new UnitView(unit, {
        side,
        position,
        visuals: this.visuals[unit.heroId],
      });
      this.units.set(unit.heroId, view);
      this.layers.units.addChild(view.container);
      return view;
    }
    existing.container.position.set(position.x, position.y);
    existing.update(unit);
    return existing;
  }

  private spawnHitSpark(target: { x: number; y: number }, style: VisualDNA | undefined, team: TeamSide) {
    const graphic = new Graphics();
    graphic.position.set(target.x, target.y - 10);
    const color = style?.palette?.accent ?? (team === "ally" ? "#a8ecff" : "#ff9fb7");
    graphic.lineStyle(3, color, 0.9);
    for (let i = 0; i < 4; i += 1) {
      const angle = (Math.PI / 2) * i + Math.PI / 4;
      const len = 18;
      graphic.moveTo(Math.cos(angle) * -4, Math.sin(angle) * -4);
      graphic.lineTo(Math.cos(angle) * len, Math.sin(angle) * len);
    }
    this.layers.fx.addChild(graphic);
    this.activeFx.push(new HitSpark(graphic));
  }

  private spawnFloatingText(target: { x: number; y: number }, text: string, color: string) {
    const label = new Text({
      text,
      style: {
        fill: color,
        fontSize: 16,
        fontWeight: "600",
        dropShadow: true,
        dropShadowBlur: 2,
        dropShadowAlpha: 0.4,
      },
    });
    label.anchor.set(0.5);
    label.position.set(target.x, target.y - 48);
    this.layers.fx.addChild(label);
    this.activeFx.push(new FloatingText(label));
  }

  private queueShake(strength: number) {
    this.activeFx.push(new ScreenShake(this.layers.units, 180, strength));
  }

  private processEvents(events: CombatFrame["events"]) {
    for (const event of events) {
      const targetView = event.targetId ? this.units.get(event.targetId) : undefined;
      const sourceView = this.units.get(event.sourceId);
      const pivot = targetView?.position ?? sourceView?.position;
      if (!pivot) continue;
      const visuals = this.visuals[event.targetId ?? event.sourceId ?? ""] ?? this.visuals[event.sourceId ?? ""];
      if (event.kind === "attack" || event.kind === "ultimate") {
        this.spawnHitSpark(pivot, visuals, event.team);
        this.spawnFloatingText(pivot, `-${event.amount}`, "#ffd166");
        this.queueShake(event.kind === "ultimate" ? 7 : 4);
      } else if (event.kind === "heal") {
        this.spawnFloatingText(pivot, `+${event.amount}`, "#7be0a2");
      } else if (event.kind === "death") {
        this.spawnFloatingText(pivot, "KO", "#ff6b6b");
        this.queueShake(6);
      }
    }
  }

  renderFrame(frame: CombatFrame) {
    for (const unit of frame.allies) {
      this.upsertUnit(unit, "ally");
    }
    for (const unit of frame.enemies) {
      this.upsertUnit(unit, "enemy");
    }
    this.processEvents(frame.events);
  }

  update(deltaMs: number) {
    for (let i = this.activeFx.length - 1; i >= 0; i -= 1) {
      const fx = this.activeFx[i];
      const alive = fx.update(deltaMs);
      if (!alive) {
        this.activeFx.splice(i, 1);
      }
    }
  }
}
