import { EventEndedError, InsufficientEnergyError, NetworkError, SimConfig, Simulator } from "../simulator";
import { CapabilityEntry, EventConfig, PlayerState } from "../types";
import { ExecuteResult, GameAdapter } from "./base";

/** Fully functional simulated game environment. Clearly labeled as a simulation. */
export class SimulatorAdapter implements GameAdapter {
  readonly kind = "simulator" as const;
  readonly sim: Simulator;

  constructor(config: SimConfig) {
    this.sim = new Simulator(config);
  }

  getConfig(): EventConfig {
    return this.sim["sim"].event;
  }

  getState(): PlayerState {
    return this.sim.state;
  }

  advance(minutes: number): void {
    this.sim.advance(minutes);
  }

  doTask(taskId: string): ExecuteResult {
    try {
      const tickets = this.sim.doTask(taskId);
      return { ok: true, ticketsEarned: tickets };
    } catch (err) {
      if (err instanceof NetworkError) {
        return { ok: false, ticketsEarned: 0, error: err.message, retryable: true };
      }
      if (err instanceof EventEndedError) {
        return {
          ok: false,
          ticketsEarned: 0,
          error: err.message,
          recommendation: "The event has ended. Generate the final report.",
          recommendationAr: "الإيفنت انتهى. اعرض التقرير النهائي.",
        };
      }
      if (err instanceof InsufficientEnergyError) {
        return {
          ok: false,
          ticketsEarned: 0,
          error: err.message,
          recommendation: `Wait for regen or use a battery (need ${err.needed}, have ${err.available}).`,
          recommendationAr: `استنى التجدد أو استخدم بطارية (محتاج ${err.needed}، معاك ${err.available}).`,
        };
      }
      return { ok: false, ticketsEarned: 0, error: String(err) };
    }
  }

  useBattery(): ExecuteResult {
    try {
      const ok = this.sim.useBattery();
      return ok
        ? { ok: true, ticketsEarned: 0 }
        : { ok: false, ticketsEarned: 0, error: "No batteries available" };
    } catch (err) {
      return { ok: false, ticketsEarned: 0, error: String(err) };
    }
  }

  capabilities(): CapabilityEntry[] {
    const src = "Built-in simulation (not the real game)";
    return [
      { capability: "Read event information", available: true, officialSource: src, limitations: "Simulated data only" },
      { capability: "Read energy", available: true, officialSource: src, limitations: "Simulated data only" },
      { capability: "Read tasks", available: true, officialSource: src, limitations: "Simulated data only" },
      { capability: "Execute event actions", available: true, officialSource: src, limitations: "Simulated data only" },
      { capability: "Collect rewards", available: true, officialSource: src, limitations: "Simulated data only" },
      { capability: "Use additional energy", available: true, officialSource: src, limitations: "Simulated data only" },
    ];
  }
}
