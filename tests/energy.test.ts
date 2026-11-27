import { describe, expect, it } from "vitest";
import { Confidence, EnergyManager, EventConfig } from "../src/core";

function cfg(patch: Partial<EventConfig> = {}): EventConfig {
  return {
    id: "t",
    name: "Test",
    durationMin: 1000,
    regenIntervalMin: 5,
    energyCap: 10,
    tasks: [],
    windows: [],
    batteryEnergy: 10,
    multiplierMode: "multiply",
    confidence: Confidence.VERIFIED,
    ...patch,
  };
}

describe("EnergyManager", () => {
  it("regenerates one point per interval up to the cap", () => {
    const em = EnergyManager.initial(cfg(), 0);
    expect(em.tick(12)).toBe(2); // 12 min / 5 min = 2 points, 2 min progress left
    expect(em.state.basic).toBe(2);
    expect(em.tick(3)).toBe(1); // 2 leftover + 3 = 5 -> one more point
    expect(em.tick(2)).toBe(0); // only 2 min progress: no point yet
    expect(em.state.basic).toBe(3);
  });

  it("never exceeds the energy cap (zero energy / max energy edge cases)", () => {
    const em = EnergyManager.initial(cfg(), 9);
    expect(em.tick(100)).toBe(1);
    expect(em.state.basic).toBe(10);
    const em2 = EnergyManager.initial(cfg(), 0);
    expect(em2.state.basic).toBe(0);
    expect(em2.spend(1, 0)).toBe(false);
  });

  it("starting energy is clamped to the cap", () => {
    const em = EnergyManager.initial(cfg(), 50);
    expect(em.state.basic).toBe(10);
  });

  it("spends soonest-expiring bonus energy before basic", () => {
    const em = EnergyManager.initial(cfg(), 5);
    em.addBonus(3, 100, "a");
    em.addBonus(4, 50, "b");
    expect(em.available(0)).toBe(12);
    expect(em.spend(5, 0)).toBe(true);
    // b (expires at 50) fully consumed, then 1 from a.
    expect(em.state.bonus).toEqual([{ id: "a", amount: 2, expiresAtMin: 100 }]);
    expect(em.state.basic).toBe(5);
  });

  it("expires bonus energy and reports it as wasted", () => {
    const em = EnergyManager.initial(cfg(), 0);
    em.addBonus(5, 30, "x");
    expect(em.available(0)).toBe(5);
    expect(em.expireBonus(31)).toBe(5);
    expect(em.available(31)).toBe(0);
  });

  it("refuses to spend more than available", () => {
    const em = EnergyManager.initial(cfg(), 3);
    expect(em.spend(4, 0)).toBe(false);
    expect(em.state.basic).toBe(3);
  });

  it("batteries convert to energy honoring the cap", () => {
    const em = EnergyManager.initial(cfg(), 8);
    em.addBattery(1);
    expect(em.useBattery()).toBe(true);
    expect(em.state.basic).toBe(10); // 8 + 10 clamped to cap 10
    expect(em.state.batteries).toBe(0);
    expect(em.useBattery()).toBe(false);
  });

  it("throws on negative spend", () => {
    const em = EnergyManager.initial(cfg(), 5);
    expect(() => em.spend(-1, 0)).toThrow();
  });
});
