export type CampaignStageRuntimeState = "locked" | "ready" | "completed";

export type CampaignMapRuntime = {
  currentStageId?: string;
  stageStates: Record<string, CampaignStageRuntimeState>;
};

type Listener = (runtime: CampaignMapRuntime) => void;

export class CampaignMapRuntimeBus {
  private listeners = new Set<Listener>();
  private lastRuntime: CampaignMapRuntime | null = null;

  emit(runtime: CampaignMapRuntime) {
    this.lastRuntime = runtime;
    this.listeners.forEach((listener) => listener(runtime));
  }

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    if (this.lastRuntime) {
      listener(this.lastRuntime);
    }
    return () => {
      this.listeners.delete(listener);
    };
  }

  getSnapshot() {
    return this.lastRuntime;
  }
}
