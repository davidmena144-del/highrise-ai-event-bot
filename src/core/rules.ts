import { Confidence, EventConfig, Rule, rule } from "./types";

/**
 * Event Intelligence Engine.
 *
 * Holds everything the system believes about the current event's mechanics,
 * with a confidence classification on every rule. Calibration upgrades rules
 * when the user confirms them from real play; simulated observations never
 * touch rules about the real event (data isolation).
 */
export class EventIntelligence {
  private rules = new Map<string, Rule<unknown>>();

  set<T>(key: string, value: T, confidence: Confidence, source: string, now = Date.now()): void {
    this.rules.set(key, rule(value, confidence, source, now));
  }

  get<T>(key: string): Rule<T> | undefined {
    return this.rules.get(key) as Rule<T> | undefined;
  }

  valueOr<T>(key: string, fallback: T): T {
    const r = this.rules.get(key);
    return r ? (r.value as T) : fallback;
  }

  /**
   * Upgrade a rule's confidence. Confidence only moves upward through
   * explicit confirmation; it never silently downgrades.
   */
  confirm(key: string, source: string, now = Date.now()): boolean {
    const r = this.rules.get(key);
    if (!r) return false;
    r.confidence = Confidence.VERIFIED;
    r.source = source;
    r.updatedAt = now;
    return true;
  }

  list(): Array<{ key: string } & Rule<unknown>> {
    return [...this.rules.entries()].map(([key, r]) => ({ key, ...r }));
  }

  /** Rules whose confidence is below VERIFIED, for honest UI display. */
  unverified(): Array<{ key: string } & Rule<unknown>> {
    return this.list().filter((r) => r.confidence !== Confidence.VERIFIED);
  }

  static fromConfig(config: EventConfig, source: string): EventIntelligence {
    const ei = new EventIntelligence();
    ei.set("event.durationMin", config.durationMin, config.confidence, source);
    ei.set("event.regenIntervalMin", config.regenIntervalMin, config.confidence, source);
    ei.set("event.energyCap", config.energyCap, config.confidence, source);
    ei.set("event.batteryEnergy", config.batteryEnergy, config.confidence, source);
    for (const t of config.tasks) {
      ei.set(`task.${t.id}.energyCost`, t.energyCost, t.confidence, source);
      ei.set(`task.${t.id}.baseTickets`, t.baseTickets, t.confidence, source);
    }
    for (const w of config.windows) {
      ei.set(`window.${w.id}.multiplier`, w.multiplier, w.confidence, source);
    }
    return ei;
  }
}
