export interface RngSnapshot {
  state: number;
}

export class DeterministicRng {
  private state: number;

  constructor(seed: number | string) {
    this.state = DeterministicRng.normalizeSeed(seed);
  }

  static normalizeSeed(seed: number | string): number {
    if (typeof seed === "number") {
      return seed >>> 0;
    }
    let hash = 2166136261;
    for (let i = 0; i < seed.length; i += 1) {
      hash ^= seed.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  static fromSnapshot(snapshot: RngSnapshot) {
    const rng = new DeterministicRng(1);
    rng.state = snapshot.state >>> 0;
    return rng;
  }

  next(): number {
    // mulberry32 variant
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    const result = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    return result;
  }

  nextInt(maxExclusive: number): number {
    if (maxExclusive <= 0) return 0;
    return Math.floor(this.next() * maxExclusive);
  }

  pick<T>(list: T[]): T {
    if (list.length === 0) {
      throw new Error("Cannot pick from empty list");
    }
    return list[this.nextInt(list.length)];
  }

  snapshot(): RngSnapshot {
    return { state: this.state >>> 0 };
  }
}
