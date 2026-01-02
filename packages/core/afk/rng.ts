export class SeededRng {
  private state: number;

  constructor(seed: number | string) {
    if (typeof seed === "string") {
      let hash = 0;
      for (let i = 0; i < seed.length; i += 1) {
        hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
      }
      this.state = hash || 1;
    } else {
      this.state = seed >>> 0;
    }
    if (this.state === 0) this.state = 1;
  }

  next(): number {
    this.state = (1664525 * this.state + 1013904223) >>> 0;
    return this.state / 0xffffffff;
  }

  pick<T>(items: T[]): T {
    if (!items.length) {
      throw new Error("cannot pick from empty array");
    }
    const idx = Math.floor(this.next() * items.length);
    return items[Math.min(items.length - 1, idx)];
  }

  int(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }
}
