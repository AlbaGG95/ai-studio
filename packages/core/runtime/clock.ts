export class RuntimeClock {
  private timeMs: number;

  constructor(startMs = 0) {
    this.timeMs = startMs;
  }

  now(): number {
    return this.timeMs;
  }

  advance(dtMs: number) {
    this.timeMs += dtMs;
  }
}
