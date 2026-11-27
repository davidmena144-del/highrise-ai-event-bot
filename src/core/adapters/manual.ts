import { EnergyManager } from "../energy";
import { CapabilityEntry, Confidence, EventConfig, PlayerState } from "../types";
import { ExecuteResult, GameAdapter } from "./base";

/**
 * Manual Adapter: the real-event path. The user enters or confirms what
 * they see in the actual Highrise app (energy, tasks, windows). The system
 * never touches the user's account: no passwords, no tokens, no scraping.
 * Nothing here "executes" in the real game; every action returns a
 * recommendation for the user to perform in the official app.
 */
export class ManualAdapter implements GameAdapter {
  readonly kind = "manual" as const;
  readonly energy: EnergyManager;
  private state: PlayerState;

  constructor(private config: EventConfig, startingEnergy: number, startingBatteries = 0) {
    this.energy = EnergyManager.initial(config, startingEnergy);
    this.energy.state.batteries = startingBatteries;
    this.state = {
      nowMin: 0,
      energy: this.energy.state,
      tickets: 0,
      executions: {},
      ended: false,
    };
  }

  /** Calibration entry point: the user corrects what the model believes. */
  calibrate(patch: {
    nowMin?: number;
    basicEnergy?: number;
    batteries?: number;
    tickets?: number;
    ended?: boolean;
  }): void {
    if (patch.nowMin !== undefined) {
      const elapsed = Math.max(0, patch.nowMin - this.state.nowMin);
      this.energy.tick(elapsed);
      this.state.nowMin = patch.nowMin;
    }
    if (patch.basicEnergy !== undefined) {
      this.energy.state.basic = Math.min(this.config.energyCap, Math.max(0, patch.basicEnergy));
    }
    if (patch.batteries !== undefined) this.energy.state.batteries = Math.max(0, patch.batteries);
    if (patch.tickets !== undefined) this.state.tickets = Math.max(0, patch.tickets);
    if (patch.ended !== undefined) this.state.ended = patch.ended;
  }

  getConfig(): EventConfig {
    return this.config;
  }

  getState(): PlayerState {
    return this.state;
  }

  advance(minutes: number): void {
    // Manual mode does not simulate time by itself; the user confirms time
    // through calibrate(). This only applies regen for the local estimate.
    this.energy.tick(minutes);
    this.state.nowMin += minutes;
  }

  /** The user reports they performed the task in the real app. */
  confirmTaskDone(taskId: string, ticketsEarned: number): void {
    const task = this.config.tasks.find((t) => t.id === taskId);
    if (task) {
      this.energy.spend(task.energyCost, this.state.nowMin);
      this.state.executions[taskId] = (this.state.executions[taskId] ?? 0) + 1;
      // The action took real time: apply regen for its duration.
      if (task.durationMin > 0) this.advance(task.durationMin);
    }
    this.state.tickets += ticketsEarned;
  }

  doTask(taskId: string): ExecuteResult {
    const task = this.config.tasks.find((t) => t.id === taskId);
    if (!task) return { ok: false, ticketsEarned: 0, error: `Unknown task: ${taskId}` };
    const available = this.energy.available(this.state.nowMin);
    if (available < task.energyCost) {
      return {
        ok: false,
        ticketsEarned: 0,
        error: `Not enough energy (need ${task.energyCost}, estimated ${available})`,
        recommendation: "Wait for regen or use a battery in the official app.",
        recommendationAr: "استنى التجدد أو استخدم بطارية في التطبيق الرسمي.",
      };
    }
    return {
      ok: false,
      ticketsEarned: 0,
      recommendation: `Do "${task.name}" in the official Highrise app now, then confirm it here.`,
      recommendationAr: `نفّذ "${task.nameAr}" في تطبيق هاي رايز الرسمي الآن، وبعدين أكّدها هنا.`,
    };
  }

  useBattery(): ExecuteResult {
    if (this.energy.state.batteries <= 0) {
      return { ok: false, ticketsEarned: 0, error: "No batteries recorded" };
    }
    return {
      ok: false,
      ticketsEarned: 0,
      recommendation: "Use one battery in the official Highrise app (tap, do not hold), then confirm here.",
      recommendationAr: "استخدم بطارية واحدة في التطبيق الرسمي (اضغط ضغطة، متطوّلش)، وبعدين أكّد هنا.",
    };
  }

  confirmBatteryUsed(): void {
    this.energy.useBattery();
  }

  capabilities(): CapabilityEntry[] {
    const src = "User-entered observations of the official app";
    return [
      { capability: "User authentication", available: false, officialSource: "https://create.highrise.game/learn/bots/guides/creating-a-bot", limitations: "No official player-account auth for third parties; user signs into the official app themselves" },
      { capability: "Read event information", available: true, officialSource: src, limitations: `Confidence ${Confidence.USER_PROVIDED}; only what the user enters` },
      { capability: "Read energy", available: true, officialSource: src, limitations: `Confidence ${Confidence.USER_PROVIDED}; estimate drifts until recalibrated` },
      { capability: "Read tasks", available: true, officialSource: src, limitations: `Confidence ${Confidence.USER_PROVIDED}` },
      { capability: "Execute event actions", available: false, officialSource: "https://create.highrise.game/learn/web-api/general/overview", limitations: "Web API is read-only public data; no player action endpoints exist" },
      { capability: "Collect rewards", available: false, officialSource: "https://create.highrise.game/learn/web-api/general/overview", limitations: "No official endpoint" },
      { capability: "Use additional energy", available: false, officialSource: "https://create.highrise.game/learn/web-api/general/overview", limitations: "No official endpoint" },
    ];
  }
}
