/**
 * Core domain types for the Highrise AI Event Bot.
 *
 * Every rule that describes real game mechanics carries a confidence
 * classification. Nothing is ever treated as verified unless it came from
 * an official source or direct user confirmation.
 */

export enum Confidence {
  /** Confirmed by an official source or observed repeatedly in real play. */
  VERIFIED = "VERIFIED",
  /** Entered or confirmed by the user. */
  USER_PROVIDED = "USER_PROVIDED",
  /** Inferred from patterns; may be wrong. */
  ESTIMATED = "ESTIMATED",
  /** No information at all. */
  UNKNOWN = "UNKNOWN",
}

export interface Rule<T> {
  value: T;
  confidence: Confidence;
  source: string;
  updatedAt: number;
}

export function rule<T>(value: T, confidence: Confidence, source: string, now = Date.now()): Rule<T> {
  return { value, confidence, source, updatedAt: now };
}

/** A time window with a ticket multiplier, e.g. Party Time x2. */
export interface MultiplierWindow {
  id: string;
  kind: "party_time" | "boost";
  /** Minutes since event start. */
  startMin: number;
  endMin: number;
  multiplier: number;
  confidence: Confidence;
}

export interface TaskDef {
  id: string;
  name: string;
  nameAr: string;
  /** Energy cost per execution. */
  energyCost: number;
  /** Minutes one execution takes (0 = instant, e.g. a daily check-in). */
  durationMin: number;
  /** Base tickets granted per execution (before multipliers). */
  baseTickets: number;
  /** True when the task can be repeated without limit. */
  repeatable: boolean;
  /** Optional cap on executions for the whole event. */
  maxExecutions?: number;
  confidence: Confidence;
}

export interface EventConfig {
  id: string;
  name: string;
  /** Event duration in minutes from start. */
  durationMin: number;
  /** Minutes of regen per 1 energy point. */
  regenIntervalMin: number;
  /** Maximum basic energy capacity. */
  energyCap: number;
  tasks: TaskDef[];
  windows: MultiplierWindow[];
  /** Battery size in energy points. */
  batteryEnergy: number;
  /** How party/boost multipliers combine. */
  multiplierMode: "multiply" | "max";
  confidence: Confidence;
}

export interface BonusEnergy {
  id: string;
  amount: number;
  /** Absolute sim-time (minutes) at which it expires; null = never. */
  expiresAtMin: number | null;
}

export interface EnergyState {
  /** Basic energy, capped at energyCap. */
  basic: number;
  /** Batteries available (each worth config.batteryEnergy). */
  batteries: number;
  /** Bonus / additional energy chunks, consumed expiry-first. */
  bonus: BonusEnergy[];
  /** Minutes since last regen point was granted (fractional accrual). */
  regenProgressMin: number;
}

export interface PlayerState {
  nowMin: number;
  energy: EnergyState;
  tickets: number;
  /** taskId -> times executed. */
  executions: Record<string, number>;
  ended: boolean;
}

export type ActionType = "do_task" | "use_battery" | "wait";

export interface Action {
  type: ActionType;
  taskId?: string;
  /** Sim-time (minutes) at which the action should happen. */
  atMin: number;
  /** Human readable explanation of why the engine recommends this. */
  reason: string;
  reasonAr: string;
}

export interface PlanStep extends Action {
  expectedTickets: number;
  multiplier: number;
}

export interface Plan {
  steps: PlanStep[];
  expectedTotalTickets: number;
  generatedAtMin: number;
  notes: string[];
}

export interface CapabilityEntry {
  capability: string;
  available: boolean;
  officialSource: string;
  limitations: string;
}

export class UnsupportedCapabilityError extends Error {
  constructor(
    public capability: string,
    message: string,
  ) {
    super(message);
    this.name = "UnsupportedCapabilityError";
  }
}
