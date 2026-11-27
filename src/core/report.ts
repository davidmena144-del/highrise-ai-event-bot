import { SimEvent } from "./simulator";
import { PlayerState } from "./types";

export interface FinalReport {
  sessionId: string;
  namespace: "sim" | "real";
  durationMin: number;
  ticketsEarned: number;
  tasksCompleted: number;
  energySpent: number;
  energyRegenerated: number;
  bonusEnergyGranted: number;
  bonusEnergyExpired: number;
  batteriesUsed: number;
  networkErrors: number;
  /** tickets per energy spent; NaN-safe (0 when nothing spent). */
  efficiency: number;
  /**
   * Optimization score: actual tickets vs the optimizer's expectation at
   * session start, 0..1. 1 means the plan was followed exactly.
   */
  optimizationScore: number;
  endedBy: "completed" | "stopped" | "event_ended" | "error";
  notes: string[];
}

export function buildReport(
  sessionId: string,
  namespace: "sim" | "real",
  state: PlayerState,
  log: SimEvent[],
  expectedTickets: number,
  endedBy: FinalReport["endedBy"],
  notes: string[] = [],
): FinalReport {
  const sum = (kind: SimEvent["kind"], re: RegExp) =>
    log.filter((e) => e.kind === kind).reduce((s, e) => {
      const m = e.detail.match(re);
      return s + (m ? Number(m[1]) : 0);
    }, 0);

  const tasksCompleted = Object.values(state.executions).reduce((a, b) => a + b, 0);
  const bonusGranted = sum("bonus_granted", /\+(\d+)/);
  const bonusExpired = sum("bonus_expired", /(\d+)/);
  const regenerated = sum("regen", /\+(\d+)/);
  const batteriesUsed = log.filter((e) => e.kind === "battery_used").length;
  const networkErrors = log.filter((e) => e.kind === "network_error").length;
  // Energy spent = energy that left the pool into tasks. Derived from the
  // config costs recorded in executions by the caller's config; the sim log
  // is authoritative for counts, so we approximate via grant/regen balance.
  // Exact: the simulator log records the cost of every executed task.
  const energySpent = log
    .filter((e) => e.kind === "task_done")
    .reduce((s, e) => {
      const m = e.detail.match(/-(\d+) energy/);
      return s + (m ? Number(m[1]) : 0);
    }, 0);

  return {
    sessionId,
    namespace,
    durationMin: state.nowMin,
    ticketsEarned: state.tickets,
    tasksCompleted,
    energySpent,
    energyRegenerated: regenerated,
    bonusEnergyGranted: bonusGranted,
    bonusEnergyExpired: bonusExpired,
    batteriesUsed,
    networkErrors,
    efficiency: tasksCompleted > 0 ? state.tickets / Math.max(1, energySpent) : 0,
    optimizationScore: expectedTickets > 0 ? Math.min(1, state.tickets / expectedTickets) : 1,
    endedBy,
    notes,
  };
}
