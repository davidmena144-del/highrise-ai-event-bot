import { describe, expect, it } from "vitest";
import {
  AutoPlayer,
  Confidence,
  EventConfig,
  MemoryStorage,
  SessionManager,
  SimConfig,
  SimulatorAdapter,
} from "../src/core";
import { randomConfig, Rng } from "./helpers";

function simCfg(event: EventConfig, seed: number, patch: Partial<SimConfig> = {}): SimConfig {
  return {
    event,
    startingEnergy: Math.floor(event.energyCap / 2),
    startingBatteries: 1,
    seed,
    networkFailureRate: 0,
    bonusDropRate: 0,
    bonusDropMin: 2,
    bonusDropMax: 5,
    bonusTtlMin: 60,
    batteryDropRate: 0,
    ...patch,
  };
}

function conf(): Confidence {
  return Confidence.ESTIMATED;
}

describe("simulator + auto player: randomized full sessions", () => {
  it("runs 400 randomized sessions to completion without invariant violations", () => {
    const rng = new Rng(2026);
    for (let i = 0; i < 400; i++) {
      const event = randomConfig(rng, { small: true });
      const adapter = new SimulatorAdapter(
        simCfg(event, rng.int(1, 1e9), {
          networkFailureRate: rng.chance(0.5) ? 0.2 : 0,
          bonusDropRate: rng.chance(0.5) ? 0.3 : 0,
          startingEnergy: rng.int(0, event.energyCap),
        }),
      );
      const ap = new AutoPlayer(adapter, { sessionId: `s${i}`, namespace: "sim" });
      ap.start();
      const status = ap.runToEnd();
      expect(["completed", "event_ended", "error", "stopped"]).toContain(status);

      const s = adapter.getState();
      // Invariants that must hold in every session.
      expect(s.energy.basic).toBeGreaterThanOrEqual(0);
      expect(s.energy.basic).toBeLessThanOrEqual(event.energyCap);
      expect(s.tickets).toBeGreaterThanOrEqual(0);
      expect(s.nowMin).toBeLessThanOrEqual(event.durationMin);
      for (const t of event.tasks) {
        if (t.maxExecutions !== undefined) {
          expect(s.executions[t.id] ?? 0).toBeLessThanOrEqual(t.maxExecutions);
        }
      }
      if (status !== "error") {
        const report = ap.getReport();
        expect(report).not.toBeNull();
        expect(report!.ticketsEarned).toBe(s.tickets);
      }
    }
  });

  it("is deterministic for the same seed", () => {
    const event = randomConfig(new Rng(5));
    const run = () => {
      const a = new SimulatorAdapter(simCfg(event, 777, { networkFailureRate: 0.3, bonusDropRate: 0.5 }));
      const ap = new AutoPlayer(a, { sessionId: "det", namespace: "sim" });
      ap.start();
      ap.runToEnd();
      return { tickets: a.getState().tickets, log: a.sim.log.map((e) => `${e.atMin}:${e.kind}:${e.detail}`) };
    };
    const r1 = run();
    const r2 = run();
    expect(r1.tickets).toBe(r2.tickets);
    expect(r1.log).toEqual(r2.log);
  });

  it("auto play matches the optimizer expectation on a clean run", () => {
    const event = randomConfig(new Rng(11), { small: true });
    event.windows = [];
    event.tasks = event.tasks.filter((t) => t.energyCost > 0);
    const adapter = new SimulatorAdapter(simCfg(event, 1, { startingEnergy: event.energyCap }));
    const ap = new AutoPlayer(adapter, { sessionId: "clean", namespace: "sim" });
    ap.start();
    ap.runToEnd();
    const report = ap.getReport()!;
    // No randomness, full information: the plan is followed exactly.
    expect(report.optimizationScore).toBeGreaterThan(0.99);
  });

  it("handles an already-expired event", () => {
    const event = randomConfig(new Rng(3));
    const adapter = new SimulatorAdapter(simCfg(event, 1));
    adapter.advance(event.durationMin + 10);
    expect(adapter.getState().ended).toBe(true);
    const ap = new AutoPlayer(adapter, { sessionId: "exp", namespace: "sim" });
    ap.start();
    ap.runToEnd();
    expect(ap.getReport()!.endedBy).toBe("event_ended");
    // Official rule: leftover energy expires with the event.
    expect(adapter.getState().energy.basic).toBe(0);
  });

  it("recovers from network interruptions with retries", () => {
    const event = randomConfig(new Rng(21), { small: true });
    const adapter = new SimulatorAdapter(simCfg(event, 42, { networkFailureRate: 0.9 }));
    const ap = new AutoPlayer(adapter, { sessionId: "net", namespace: "sim", maxRetries: 3 });
    ap.start();
    const status = ap.runToEnd();
    expect(["error", "completed", "event_ended"]).toContain(status);
    expect(adapter.sim.log.some((e) => e.kind === "network_error")).toBe(true);
  });

  it("grants and expires bonus energy inside sessions", () => {
    const event = randomConfig(new Rng(31));
    const adapter = new SimulatorAdapter(simCfg(event, 9, { bonusDropRate: 1, bonusTtlMin: 5 }));
    adapter.sim.doTask(event.tasks[0].id);
    expect(adapter.sim.log.some((e) => e.kind === "bonus_granted")).toBe(true);
    adapter.advance(10);
    expect(adapter.sim.log.some((e) => e.kind === "bonus_expired")).toBe(true);
  });
});

describe("auto player controls", () => {
  it("pause/resume/stopNow state machine transitions", () => {
    const event = randomConfig(new Rng(77));
    const adapter = new SimulatorAdapter(simCfg(event, 5));
    const ap = new AutoPlayer(adapter, { sessionId: "ctl", namespace: "sim" });
    expect(ap.getStatus()).toBe("idle");
    ap.pause(); // no-op from idle
    expect(ap.getStatus()).toBe("idle");
    ap.start();
    expect(ap.getStatus()).toBe("running");
    ap.pause();
    expect(ap.getStatus()).toBe("paused");
    expect(ap.step()).toBe(false); // paused: no work
    ap.resume();
    expect(ap.getStatus()).toBe("running");
    ap.stopNow();
    expect(ap.getStatus()).toBe("stopped");
    expect(ap.getReport()!.endedBy).toBe("stopped");
    expect(ap.step()).toBe(false);
  });

  it("stopNow works mid-execution and produces a partial report", () => {
    const event = randomConfig(new Rng(78), { small: true });
    const adapter = new SimulatorAdapter(simCfg(event, 6));
    const ap = new AutoPlayer(adapter, { sessionId: "mid", namespace: "sim" });
    ap.start();
    ap.step();
    ap.step();
    ap.stopNow();
    const report = ap.getReport()!;
    expect(report.endedBy).toBe("stopped");
    expect(report.ticketsEarned).toBe(adapter.getState().tickets);
  });

  it("rejects start from an invalid state", () => {
    const event = randomConfig(new Rng(79));
    const adapter = new SimulatorAdapter(simCfg(event, 7));
    const ap = new AutoPlayer(adapter, { sessionId: "inv", namespace: "sim" });
    ap.start();
    expect(() => ap.start()).toThrow();
  });

  it("session recovery restores an interrupted session", () => {
    const event = randomConfig(new Rng(80), { small: true });
    const storage = new MemoryStorage();
    const sessions = new SessionManager(storage);
    const adapter = new SimulatorAdapter(simCfg(event, 8));
    const ap = new AutoPlayer(adapter, { sessionId: "rec", namespace: "sim", sessions });
    ap.start();
    ap.step();
    ap.pause();
    expect(sessions.loadSnapshot("sim", "rec")).not.toBeNull();

    const ap2 = new AutoPlayer(adapter, { sessionId: "rec", namespace: "sim", sessions });
    expect(ap2.recover()).toBe(true);
    expect(ap2.getStatus()).toBe("paused");
    ap2.resume();
    ap2.runToEnd();
    expect(ap2.getReport()).not.toBeNull();
    // Completed sessions clean up their snapshot.
    expect(sessions.loadSnapshot("sim", "rec")).toBeNull();
  });
});
