import { Container, Graphics, Text } from "pixi.js";
import { AfkBattleUnit as BattleUnit, VisualDNA } from "@ai-studio/core";
import { SlotPosition, TeamSide } from "./types";

interface UnitViewOptions {
  side: TeamSide;
  position: SlotPosition;
  visuals?: VisualDNA;
}

export class UnitView {
  container: Container;
  private body: Graphics;
  private hpBar: Graphics;
  private hpBack: Graphics;
  private label: Text;
  private visuals?: VisualDNA;
  readonly side: TeamSide;
  readonly heroId: string;

  constructor(unit: BattleUnit, options: UnitViewOptions) {
    this.heroId = unit.heroId;
    this.side = options.side;
    this.visuals = options.visuals;
    this.container = new Container();
    this.container.position.set(options.position.x, options.position.y);

    this.body = new Graphics();
    this.hpBack = new Graphics();
    this.hpBar = new Graphics();
    this.label = new Text({
      text: unit.name,
      style: {
        fill: "#e8ecf4",
        fontSize: 12,
        fontFamily: "Inter, sans-serif",
      },
    });

    this.container.addChild(this.body);
    this.container.addChild(this.hpBack);
    this.container.addChild(this.hpBar);
    this.container.addChild(this.label);
    this.label.anchor.set(0.5);
    this.label.position.set(0, -48);

    this.redraw(unit);
  }

  get position() {
    return this.container.position;
  }

  private color(field: keyof VisualDNA["palette"], fallback: string) {
    return this.visuals?.palette?.[field] ?? fallback;
  }

  private drawShape(unit: BattleUnit) {
    const primary = this.color("primary", this.side === "ally" ? "#3c6ff9" : "#f04e6a");
    const secondary = this.color("secondary", this.side === "ally" ? "#7cb7ff" : "#ff9fb7");
    const accent = this.color("accent", "#f6f7fb");
    this.body.clear();
    this.body.lineStyle(2, accent, 0.9);
    this.body.beginFill(primary, 0.9);
    const w = 70;
    const h = 96;
    const tilt = this.side === "ally" ? -0.12 : 0.12;
    this.body.drawRoundedRect(-w / 2, -h / 2, w, h, 16);
    this.body.endFill();
    this.body.beginFill(secondary, 0.6);
    this.body.moveTo(-w / 2, h / 2 - 10);
    this.body.lineTo(w / 2, h / 2 - 14);
    this.body.lineTo(w / 2 - 12, -h / 2 + 18);
    this.body.lineTo(-w / 2 + 8, -h / 2 + 26);
    this.body.closePath();
    this.body.endFill();
    this.body.rotation = tilt;
    if (!unit.alive) {
      this.body.alpha = 0.35;
    } else {
      this.body.alpha = 1;
    }
  }

  private drawHp(unit: BattleUnit) {
    const ratio = Math.max(0, Math.min(1, unit.hp / Math.max(1, unit.maxHp)));
    const barW = 78;
    this.hpBack.clear();
    this.hpBack.beginFill("#1c2433", 0.7);
    this.hpBack.drawRoundedRect(-barW / 2, 54, barW, 8, 3);
    this.hpBack.endFill();

    this.hpBar.clear();
    this.hpBar.beginFill(this.side === "ally" ? "#2dd4bf" : "#f56565");
    this.hpBar.drawRoundedRect(-barW / 2, 54, barW * ratio, 8, 3);
    this.hpBar.endFill();
    this.hpBar.alpha = unit.alive ? 1 : 0.2;
  }

  redraw(unit: BattleUnit) {
    this.drawShape(unit);
    this.drawHp(unit);
  }

  update(unit: BattleUnit) {
    this.redraw(unit);
    this.container.alpha = unit.alive ? 1 : 0.4;
  }
}
