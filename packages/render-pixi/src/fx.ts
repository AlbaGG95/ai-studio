import { Container, Graphics, Text } from "pixi.js";

export interface ActiveFx {
  update(deltaMs: number): boolean;
}

export class HitSpark implements ActiveFx {
  private elapsed = 0;
  private readonly lifetime = 260;
  private readonly graphic: Graphics;

  constructor(graphic: Graphics) {
    this.graphic = graphic;
    this.graphic.alpha = 1;
  }

  update(deltaMs: number): boolean {
    this.elapsed += deltaMs;
    const t = Math.max(0, 1 - this.elapsed / this.lifetime);
    this.graphic.alpha = t;
    this.graphic.scale.set(0.8 + 0.4 * t);
    this.graphic.rotation += 0.08;
    return this.elapsed < this.lifetime;
  }
}

export class FloatingText implements ActiveFx {
  private elapsed = 0;
  private readonly lifetime = 900;
  private readonly text: Text;
  private readonly velocity: number;

  constructor(text: Text, velocity = -0.06) {
    this.text = text;
    this.velocity = velocity;
  }

  update(deltaMs: number): boolean {
    this.elapsed += deltaMs;
    this.text.y += deltaMs * this.velocity;
    const t = Math.max(0, 1 - this.elapsed / this.lifetime);
    this.text.alpha = t;
    return this.elapsed < this.lifetime;
  }
}

export class ScreenShake implements ActiveFx {
  private elapsed = 0;
  private readonly lifetime: number;
  private readonly magnitude: number;
  private readonly target: Container;

  constructor(target: Container, lifetime = 220, magnitude = 4) {
    this.target = target;
    this.lifetime = lifetime;
    this.magnitude = magnitude;
  }

  update(deltaMs: number): boolean {
    this.elapsed += deltaMs;
    const t = Math.max(0, 1 - this.elapsed / this.lifetime);
    const strength = this.magnitude * t;
    this.target.position.set(
      (Math.random() - 0.5) * strength,
      (Math.random() - 0.5) * strength
    );
    if (this.elapsed >= this.lifetime) {
      this.target.position.set(0, 0);
      return false;
    }
    return true;
  }
}
