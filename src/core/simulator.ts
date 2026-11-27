import { EnergyManager } from "./energy";
import { Rng } from "./rng";
import { BonusEnergy, EventConfig, PlayerState } from "./types";

export interface SimEvent {
  atMin: number;
  kind:
    | "task_done"
    | "battery_used"
    | "bonus_granted"
    | "bonus_expired"
    | "network_error"
    | "regen"
    | "event_ended"
    | "battery_granted";
  detail: string;
}

export interface SimConfig {
  event: EventConfig;
  startingEnergy: number;
  startingBatteries: number;
  seed: number;
  /** Probability that any task execution fails with a network error. */
  networkFailureRate: number;
  /** Probability per task execution of a random bonus energy drop. */
  bonusDropRate: number;
  /** Bonus drop size range. */
  bonusDropMin: number;
  bonusDropMax: number;
  /** Bonus drop lifetime in minutes (null = never expires). */
  bonusTtlMin: number | null;
  /** Probability per task execution of finding an extra battery. */
  batteryDropRate: number;
}

export class NetworkError extends Error {
  constructor() {
    super("Simulated network interruption");
    this.name = "NetworkError";
  }
}

export class EventEndedError extends Error {
  constructor() {
    super("The event has ended");
    this.name = "EventEndedError";
  }
}

export class InsufficientEnergyError extends Error {
  constructor(
    public needed: number,
    public available: number,
  ) {
    super(`Insufficient energy: need ${needed}, have ${available}`);
    this.name = "InsufficientEnergyError";
  }
}

/**
 * Advanced event simulator. Clearly a simulation: it never touches real
 * account data and its storage namespace is separate (see session.ts).
 * Deterministic for a given seed.
 */
export class Simulator {
  readonly energy: EnergyManager;
  readonly log: SimEvent[] = [];
  state: PlayerState;
  private rng: Rng;
  private dropCounter = 0;

  constructor(private sim: SimConfig) {
    this.rng = new Rng(sim.seed);
    this.energy = EnergyManager.initial(sim.event, sim.startingEnergy);
    this.energy.state.batteries = sim.startingBatteries;
    this.state = {
      nowMin: 0,
      energy: this.energy.state,
      tickets: 0,
      executions: {},
      ended: false,
    };
  }

  private get now(): number {
    return this.state.nowMin;
  }

  multiplierAt(min: number): number {
    const active = this.sim.event.windows.filter((w) => w.startMin <= min && min < w.endMin);
    if (active.length === 0) return 1;
    if (this.sim.event.multiplierMode === "max") return Math.max(...active.map((w) => w.multiplier));
    return active.reduce((m, w) => m * w.multiplier, 1);
  }

  /** Advance simulated time; applies regen, bonus expiry and event end. */
  advance(minutes: number): void {
    if (this.state.ended) return;
    const target = Math.min(this.now + minutes, this.sim.event.durationMin);
    const elapsed = target - this.now;
    const gained = this.energy.tick(elapsed);
    if (gained > 0) this.log.push({ atMin: target, kind: "regen", detail: `+${gained} energy regenerated` });
    this.state.nowMin = target;
    const expired = this.energy.expireBonus(this.now);
    if (expired > 0)
      this.log.push({ atMin: this.now, kind: "bonus_expired", detail: `${expired} bonus energy expired` });
    if (this.now >= this.sim.event.durationMin && !this.state.ended) {
      this.state.ended = true;
      // Official rule (VERIFIED, Highrise support): leftover energy expires
      // with the event; batteries persist but are worthless in this sim.
      this.energy.state.basic = 0;
      this.energy.state.bonus = [];
      this.log.push({ atMin: this.now, kind: "event_ended", detail: "Event ended; leftover energy expired" });
    }
  }

  private pushGranted(amount: number, ttl: number | null, why: string): BonusEnergy {
    const id = `bonus-${this.dropCounter++}`;
    const expiresAt = ttl === null ? null : this.now + ttl;
    this.energy.addBonus(amount, expiresAt, id);
    this.log.push({ atMin: this.now, kind: "bonus_granted", detail: `+${amount} bonus energy (${why})` });
    return { id, amount, expiresAtMin: expiresAt };
  }

  /**
   * Execute one task once. Throws NetworkError (retryable), EventEndedError
   * or InsufficientEnergyError. Returns tickets earned.
   */
  doTask(taskId: string): number {
    if (this.state.ended) throw new EventEndedError();
    if (this.sim.networkFailureRate > 0 && this.rng.chance(this.sim.networkFailureRate)) {
      this.log.push({ atMin: this.now, kind: "network_error", detail: `task ${taskId} hit a network interruption` });
      throw new NetworkError();
    }
    const task = this.sim.event.tasks.find((t) => t.id === taskId);
    if (!task) throw new Error(`Unknown task: ${taskId}`);
    const done = this.state.executions[taskId] ?? 0;
    if (task.maxExecutions !== undefined && done >= task.maxExecutions) {
      throw new Error(`Task ${taskId} exhausted (${task.maxExecutions} executions)`);
    }
    const available = this.energy.available(this.now);
    if (!this.energy.spend(task.energyCost, this.now)) {
      throw new InsufficientEnergyError(task.energyCost, available);
    }
    const mult = this.multiplierAt(this.now);
    const tickets = task.baseTickets * mult;
    this.state.tickets += tickets;
    this.state.executions[taskId] = done + 1;
    this.log.push({
      atMin: this.now,
      kind: "task_done",
      detail: `${task.name} -> ${tickets} tickets (x${mult}, -${task.energyCost} energy)`,
    });
    // The action takes time: regen, bonus expiry and event end all apply.
    if (task.durationMin > 0) this.advance(task.durationMin);
    // Random bonus energy reward (e.g. from a ticket track tier or an ad),
    // granted after the action's time has passed.
    if (!this.state.ended && this.sim.bonusDropRate > 0 && this.rng.chance(this.sim.bonusDropRate)) {
      this.pushGranted(this.rng.int(this.sim.bonusDropMin, this.sim.bonusDropMax), this.sim.bonusTtlMin, "random drop");
    }
    if (!this.state.ended && this.sim.batteryDropRate > 0 && this.rng.chance(this.sim.batteryDropRate)) {
      this.energy.addBattery(1);
      this.log.push({ atMin: this.now, kind: "battery_granted", detail: "+1 battery found" });
    }
    return tickets;
  }

  useBattery(): boolean {
    if (this.state.ended) throw new EventEndedError();
    const ok = this.energy.useBattery();
    if (ok) this.log.push({ atMin: this.now, kind: "battery_used", detail: "Battery converted to energy" });
    return ok;
  }

  grantBonus(amount: number, ttlMin: number | null, why: string): void {
    this.pushGranted(amount, ttlMin, why);
  }
}
