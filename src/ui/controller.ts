import {
  AutoPlayer,
  defaultEventConfig,
  EventConfig,
  FinalReport,
  GameAdapter,
  ManualAdapter,
  MemoryStorage,
  Plan,
  SessionManager,
  SessionRecord,
  SimConfig,
  SimulatorAdapter,
  StorageLike,
  optimizeGreedy,
  buildPlan,
} from "../core";

/** localStorage-backed storage (web); falls back to memory in tests. */
export class WebStorage implements StorageLike {
  constructor(private backing: Storage | null) {}
  getItem(key: string): string | null {
    return this.backing ? this.backing.getItem(key) : null;
  }
  setItem(key: string, value: string): void {
    this.backing?.setItem(key, value);
  }
  removeItem(key: string): void {
    this.backing?.removeItem(key);
  }
  keys(): string[] {
    if (!this.backing) return [];
    const out: string[] = [];
    for (let i = 0; i < this.backing.length; i++) out.push(this.backing.key(i)!);
    return out;
  }
}

export type Mode = "sim" | "real";

let sessionCounter = 0;

/**
 * UI controller: owns the adapter, auto player and session manager.
 * React subscribes through listen(); every mutation calls emit().
 */
export class UiController {
  mode: Mode = "sim";
  config: EventConfig = defaultEventConfig();
  adapter: GameAdapter;
  autoPlayer: AutoPlayer;
  sessions: SessionManager;
  report: FinalReport | null = null;
  plan: Plan | null = null;
  greedyTickets = 0;
  sessionId = `session-${++sessionCounter}`;
  simOptions = { networkFailureRate: 0.05, bonusDropRate: 0.1, seed: 42 };
  private listeners = new Set<() => void>();

  constructor(storage?: StorageLike) {
    this.sessions = new SessionManager(storage ?? new MemoryStorage());
    this.adapter = this.makeSimAdapter();
    this.autoPlayer = this.makeAutoPlayer(this.adapter);
    this.recomputePlan();
  }

  private makeSimAdapter(): SimulatorAdapter {
    const sim: SimConfig = {
      event: this.config,
      startingEnergy: Math.floor(this.config.energyCap / 2),
      startingBatteries: 2,
      seed: this.simOptions.seed,
      networkFailureRate: this.simOptions.networkFailureRate,
      bonusDropRate: this.simOptions.bonusDropRate,
      bonusDropMin: 2,
      bonusDropMax: 6,
      bonusTtlMin: 120,
      batteryDropRate: 0.02,
    };
    return new SimulatorAdapter(sim);
  }

  private makeAutoPlayer(adapter: GameAdapter): AutoPlayer {
    return new AutoPlayer(adapter, {
      sessionId: this.sessionId,
      namespace: this.mode,
      sessions: this.sessions,
    });
  }

  listen(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  emit(): void {
    for (const fn of this.listeners) fn();
  }

  setMode(mode: Mode): void {
    this.mode = mode;
    this.reset();
  }

  setConfig(config: EventConfig): void {
    this.config = config;
    this.reset();
  }

  reset(): void {
    this.sessionId = `session-${++sessionCounter}`;
    this.adapter = this.mode === "sim"
      ? this.makeSimAdapter()
      : new ManualAdapter(this.config, Math.floor(this.config.energyCap / 2), 2);
    this.autoPlayer = this.makeAutoPlayer(this.adapter);
    this.report = null;
    this.recomputePlan();
    this.emit();
  }

  recomputePlan(): void {
    const s = this.adapter.getState();
    this.plan = buildPlan({
      config: this.config,
      nowMin: s.nowMin,
      energy: s.energy.basic,
      executions: s.executions,
      regenProgressMin: s.energy.regenProgressMin,
    });
    this.greedyTickets = optimizeGreedy({
      config: this.config,
      nowMin: s.nowMin,
      energy: s.energy.basic,
      executions: s.executions,
      regenProgressMin: s.energy.regenProgressMin,
    });
  }

  start(): void {
    this.autoPlayer.start();
    this.emit();
  }

  pause(): void {
    this.autoPlayer.pause();
    this.emit();
  }

  resume(): void {
    this.autoPlayer.resume();
    this.emit();
  }

  stopNow(): void {
    this.autoPlayer.stopNow();
    this.report = this.autoPlayer.getReport();
    this.emit();
  }

  step(): void {
    if (this.autoPlayer.getStatus() === "idle") this.autoPlayer.start();
    this.autoPlayer.step();
    this.report = this.autoPlayer.getReport();
    this.recomputePlan();
    this.emit();
  }

  runToEnd(): void {
    const status = this.autoPlayer.getStatus();
    if (status === "idle" || status === "stopped" || status === "error") this.autoPlayer.start();
    this.autoPlayer.runToEnd();
    this.report = this.autoPlayer.getReport();
    this.recomputePlan();
    this.emit();
  }

  history(): { sim: SessionRecord[]; real: SessionRecord[] } {
    return { sim: this.sessions.listSessions("sim"), real: this.sessions.listSessions("real") };
  }
}
