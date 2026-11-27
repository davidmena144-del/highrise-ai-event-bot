import { describe, expect, it } from "vitest";
import {
  CAPABILITY_MATRIX,
  Confidence,
  EventIntelligence,
  ManualAdapter,
  MemoryStorage,
  OfficialAdapter,
  SessionManager,
  UnsupportedCapabilityError,
  defaultEventConfig,
} from "../src/core";
import { randomConfig, Rng } from "./helpers";

describe("data isolation", () => {
  it("sim and real namespaces never share keys or snapshots", () => {
    const sm = new SessionManager(new MemoryStorage());
    sm.saveSnapshot("sim", "a", { savedAtMin: 1, adapterKind: "simulator", autoPlayerState: "running", playerState: {}, logSize: 0 });
    sm.saveSnapshot("real", "a", { savedAtMin: 2, adapterKind: "manual", autoPlayerState: "paused", playerState: {}, logSize: 0 });
    expect(sm.loadSnapshot("sim", "a")!.savedAtMin).toBe(1);
    expect(sm.loadSnapshot("real", "a")!.savedAtMin).toBe(2);

    sm.recordSession({ sessionId: "a", namespace: "sim", startedAt: 1, endedAt: 2, summary: "sim run" });
    sm.recordSession({ sessionId: "b", namespace: "real", startedAt: 1, endedAt: 2, summary: "real run" });
    expect(sm.listSessions("sim").map((r) => r.sessionId)).toEqual(["a"]);
    expect(sm.listSessions("real").map((r) => r.sessionId)).toEqual(["b"]);
    expect(() => sm.assertIsolation()).not.toThrow();
  });

  it("simulated observations never upgrade real-event rules", () => {
    const ei = new EventIntelligence();
    ei.set("event.regenIntervalMin", 4, Confidence.ESTIMATED, "community guide");
    // A simulator run "observing" regen 5 must not touch the real rule.
    // There is no API for that by design; the only write path is explicit.
    expect(ei.get("event.regenIntervalMin")!.confidence).toBe(Confidence.ESTIMATED);
    ei.confirm("event.regenIntervalMin", "user confirmed from app");
    expect(ei.get("event.regenIntervalMin")!.confidence).toBe(Confidence.VERIFIED);
  });
});

describe("official adapter fails safely", () => {
  it("throws UnsupportedCapabilityError instead of pretending", () => {
    const official = new OfficialAdapter();
    expect(() => official.getState()).toThrow(UnsupportedCapabilityError);
    expect(() => official.getConfig()).toThrow(UnsupportedCapabilityError);
    const r = official.doTask();
    expect(r.ok).toBe(false);
    expect(r.recommendationAr).toBeTruthy();
  });

  it("never claims undocumented capabilities", () => {
    for (const entry of CAPABILITY_MATRIX) {
      expect(entry.officialSource).toMatch(/^https:\/\//);
    }
    const exec = CAPABILITY_MATRIX.find((c) => c.capability === "Execute event actions");
    expect(exec!.available).toBe(false);
  });
});

describe("manual adapter", () => {
  it("calibrates from user input and only recommends actions", () => {
    const cfg = defaultEventConfig();
    const m = new ManualAdapter(cfg, 10, 2);
    m.calibrate({ basicEnergy: 3, tickets: 100, nowMin: 60 });
    expect(m.getState().energy.basic).toBe(3);
    expect(m.getState().tickets).toBe(100);
    const r = m.doTask(cfg.tasks[0].id);
    expect(r.ok).toBe(false); // never executes on the real account
    expect(r.recommendationAr).toBeTruthy();
    m.confirmTaskDone(cfg.tasks[0].id, cfg.tasks[0].baseTickets);
    expect(m.getState().tickets).toBe(100 + cfg.tasks[0].baseTickets);
    expect(m.getState().energy.basic).toBe(3 - cfg.tasks[0].energyCost);
  });
});

describe("default config honesty", () => {
  it("labels community-sourced numbers as ESTIMATED, not VERIFIED", () => {
    const cfg = defaultEventConfig();
    expect(cfg.confidence).toBe(Confidence.ESTIMATED);
    for (const w of cfg.windows) expect(w.confidence).toBe(Confidence.ESTIMATED);
  });
});
