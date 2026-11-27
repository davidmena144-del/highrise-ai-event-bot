import { GameAdapter } from "./adapters/base";
import { batteryAdvice, buildPlan } from "./optimizer";
import { buildReport, FinalReport } from "./report";
import { SessionManager, SessionNamespace } from "./session";
import { SimEvent } from "./simulator";
import { Plan } from "./types";

export type AutoPlayerStatus =
  | "idle"
  | "running"
  | "paused"
  | "stopping"
  | "stopped"
  | "completed"
  | "error";

export interface AutoPlayerOptions {
  sessionId: string;
  namespace: SessionNamespace;
  sessions?: SessionManager;
  /** Max consecutive retryable errors before giving up. */
  maxRetries?: number;
  /** Minutes to wait between retries. */
  retryBackoffMin?: number;
  /** Planning horizon cap in minutes (defaults to event end). */
  horizonMin?: number;
}

export interface ProgressInfo {
  status: AutoPlayerStatus;
  nowMin: number;
  tickets: number;
  tasksCompleted: number;
  energyAvailable: number;
  batteries: number;
  currentAction: string | null;
  retries: number;
}

/**
 * Event Auto Player: a strict state machine that executes optimizer plans
 * through a GameAdapter. Controls: start, pause, resume, stopNow, plus
 * session recovery, progress/energy/reward tracking and error recovery.
 *
 * It never bypasses anything: it only calls adapter methods, and adapters
 * only do what is officially permitted (simulator: full play; manual:
 * recommendations; official: safe failure).
 */
export class AutoPlayer {
  private status: AutoPlayerStatus = "idle";
  private plan: Plan | null = null;
  private planIndex = 0;
  private retries = 0;
  private currentAction: string | null = null;
  private expectedTicketsAtStart = 0;
  private report: FinalReport | null = null;
  private lastError: string | null = null;

  private readonly maxRetries: number;
  private readonly retryBackoffMin: number;

  constructor(
    private adapter: GameAdapter,
    private opts: AutoPlayerOptions,
  ) {
    this.maxRetries = opts.maxRetries ?? 3;
    this.retryBackoffMin = opts.retryBackoffMin ?? 5;
  }

  getStatus(): AutoPlayerStatus {
    return this.status;
  }

  getReport(): FinalReport | null {
    return this.report;
  }

  getError(): string | null {
    return this.lastError;
  }

  progress(): ProgressInfo {
    const s = this.adapter.getState();
    return {
      status: this.status,
      nowMin: s.nowMin,
      tickets: s.tickets,
      tasksCompleted: Object.values(s.executions).reduce((a, b) => a + b, 0),
      energyAvailable: s.energy.bonus.reduce((a, b) => a + b.amount, 0) + s.energy.basic,
      batteries: s.energy.batteries,
      currentAction: this.currentAction,
      retries: this.retries,
    };
  }

  /** Recalculate the plan from the current state. Called after every change. */
  private replan(notes: string[] = []): void {
    const s = this.adapter.getState();
    const config = this.adapter.getConfig();
    this.plan = buildPlan(
      {
        config,
        nowMin: s.nowMin,
        energy: s.energy.basic,
        // Rolling 6h planning window by default (see docs/LIMITATIONS.md).
        horizonMin: this.opts.horizonMin ?? Math.min(config.durationMin, s.nowMin + 360),
        executions: s.executions,
        regenProgressMin: s.energy.regenProgressMin,
      },
      notes,
    );
    this.planIndex = 0;
  }

  start(): void {
    if (this.status !== "idle" && this.status !== "stopped" && this.status !== "error") {
      throw new Error(`Cannot start from status ${this.status}`);
    }
    this.status = "running";
    this.retries = 0;
    this.replan(["Plan generated at session start"]);
    this.expectedTicketsAtStart = this.plan?.expectedTotalTickets ?? 0;
    this.persist();
  }

  pause(): void {
    if (this.status !== "running") return;
    this.status = "paused";
    this.persist();
  }

  resume(): void {
    if (this.status !== "paused") return;
    this.status = "running";
    // The world may have moved while paused: recalculate.
    this.replan(["Recalculated after resume"]);
  }

  /** Immediate stop. Works from any active state, mid-action. */
  stopNow(): void {
    if (this.status === "completed" || this.status === "stopped" || this.status === "idle") return;
    this.status = "stopping";
    this.currentAction = null;
    this.finish("stopped");
  }

  private persist(): void {
    this.opts.sessions?.saveSnapshot(this.opts.namespace, this.opts.sessionId, {
      savedAtMin: this.adapter.getState().nowMin,
      adapterKind: this.adapter.kind,
      autoPlayerState: this.status,
      playerState: JSON.parse(JSON.stringify(this.adapter.getState())),
      logSize: 0,
    });
  }

  /**
   * Session recovery: restore a previously persisted session. The auto
   * player rebuilds its plan from the recovered state, so an interrupted
   * session continues instead of restarting.
   */
  recover(): boolean {
    if (!this.opts.sessions) return false;
    const snap = this.opts.sessions.loadSnapshot(this.opts.namespace, this.opts.sessionId);
    if (!snap) return false;
    this.status = "paused";
    this.replan(["Recalculated after session recovery"]);
    return true;
  }

  private finish(endedBy: FinalReport["endedBy"]): void {
    const s = this.adapter.getState();
    const log = ((this.adapter as unknown as { sim?: { log: SimEvent[] } }).sim?.log ?? []) as SimEvent[];
    this.report = buildReport(
      this.opts.sessionId,
      this.opts.namespace,
      s,
      log,
      this.expectedTicketsAtStart,
      endedBy,
      this.plan?.notes ?? [],
    );
    this.opts.sessions?.recordSession({
      sessionId: this.opts.sessionId,
      namespace: this.opts.namespace,
      startedAt: Date.now(),
      endedAt: Date.now(),
      summary: `${this.report.ticketsEarned} tickets, ${this.report.tasksCompleted} tasks, ended by ${endedBy}`,
    });
    this.opts.sessions?.deleteSnapshot(this.opts.namespace, this.opts.sessionId);
    this.status = endedBy === "stopped" ? "stopped" : endedBy === "error" ? "error" : "completed";
  }

  /**
   * Run one step of the event loop. Returns false when there is nothing
   * left to do (completed / stopped / paused / error).
   *
   * Each step: advance time to the next planned action, consider the
   * battery heuristic, execute, then recalculate (resources changed).
   */
  step(): boolean {
    if (this.status !== "running") return false;
    const s = this.adapter.getState();
    if (s.ended) {
      this.finish("event_ended");
      return false;
    }
    const config = this.adapter.getConfig();

    // Battery heuristic on top of the DP plan.
    const batt = batteryAdvice(config, s.nowMin, s.energy.basic, s.energy.batteries);
    if (batt) {
      this.currentAction = batt.reasonAr;
      this.adapter.useBattery();
      this.replan(["Recalculated after using a battery"]);
    }

    if (!this.plan || this.planIndex >= this.plan.steps.length) {
      // Nothing executable remains. If regen can still produce energy before
      // the event ends, wait for it; otherwise the session is complete.
      const cheapest = Math.min(...config.tasks.map((t) => t.energyCost).filter((c) => c > 0));
      const regenNeeded = Number.isFinite(cheapest) ? cheapest - s.energy.basic : Infinity;
      const waitMin = regenNeeded * config.regenIntervalMin - s.energy.regenProgressMin;
      if (regenNeeded > 0 && s.nowMin + waitMin < config.durationMin) {
        this.currentAction = `انتظار التجدد ${waitMin} دقيقة`;
        this.adapter.advance(waitMin);
        this.replan(["Recalculated after waiting for regen"]);
        return this.status === "running";
      }
      this.finish("completed");
      return false;
    }

    const stepPlan = this.plan.steps[this.planIndex];
    // Advance time to the planned moment (regen applies on the way).
    if (stepPlan.atMin > s.nowMin) {
      this.adapter.advance(stepPlan.atMin - s.nowMin);
    }
    this.currentAction = stepPlan.reasonAr;

    if (stepPlan.type === "do_task" && stepPlan.taskId) {
      const result = this.adapter.doTask(stepPlan.taskId);
      if (!result.ok) {
        if (result.retryable) {
          this.retries += 1;
          if (this.retries > this.maxRetries) {
            this.lastError = result.error ?? "Too many failures";
            this.finish("error");
            return false;
          }
          // Error recovery: back off, then retry with a fresh plan.
          this.adapter.advance(this.retryBackoffMin);
          this.replan([`Recalculated after retry ${this.retries}: ${result.error}`]);
          return this.status === "running";
        }
        // Non-retryable failure (e.g. not enough energy): replan and move on.
        this.replan([`Recalculated after: ${result.error}`]);
        if (this.plan.steps.length === 0) {
          this.planIndex = 0;
          return this.step();
        }
        return this.status === "running";
      }
      this.retries = 0;
      this.planIndex += 1;
      // Resources changed: recalculate the remaining plan.
      this.replan();
      this.persist();
      return this.status === "running";
    }

    this.planIndex += 1;
    return true;
  }

  /** Run until completion, stop, pause, or error. Bounded for safety. */
  runToEnd(maxSteps = 100_000): AutoPlayerStatus {
    let n = 0;
    while (this.status === "running" && n < maxSteps) {
      this.step();
      n++;
    }
    return this.status;
  }

  /** Next recommended action for the user (used by manual mode). */
  nextRecommendation(): string | null {
    const s = this.adapter.getState();
    const config = this.adapter.getConfig();
    const batt = batteryAdvice(config, s.nowMin, s.energy.basic, s.energy.batteries);
    if (batt) return batt.reasonAr;
    if (!this.plan) this.replan();
    const next = this.plan?.steps[this.planIndex];
    return next ? next.reasonAr : null;
  }
}
