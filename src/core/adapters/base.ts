import { CapabilityEntry, EventConfig, PlayerState } from "../types";

export interface ExecuteResult {
  ok: boolean;
  ticketsEarned: number;
  /** When an action cannot be executed, a human-readable next step. */
  recommendation?: string;
  recommendationAr?: string;
  error?: string;
  retryable?: boolean;
}

/**
 * Game Adapter interface: the single seam between the optimizer/auto player
 * and any game environment. The optimizer never talks to a game directly.
 */
export interface GameAdapter {
  readonly kind: "simulator" | "manual" | "official";
  getConfig(): EventConfig;
  getState(): PlayerState;
  /** Advance the environment clock (simulator only; others are no-ops). */
  advance(minutes: number): void;
  doTask(taskId: string): ExecuteResult;
  useBattery(): ExecuteResult;
  /** What this adapter can actually do, for honest UI and reports. */
  capabilities(): CapabilityEntry[];
}
