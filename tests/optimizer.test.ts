import { describe, expect, it } from "vitest";
import { multiplierAt, optimizeDp, optimizeGreedy } from "../src/core";
import { randomConfig, Rng } from "./helpers";

/**
 * Reference algorithm: exhaustive search with memoization over (t, e).
 * Independent of the DP implementation; used to verify DP optimality.
 */
function bruteForce(
  config: ReturnType<typeof randomConfig>,
  startMin: number,
  energy: number,
): number {
  const horizon = config.durationMin;
  const cap = config.energyCap;
  const interval = config.regenIntervalMin;
  const memo = new Map<string, number>();

  const gainBetween = (a: number, b: number) =>
    interval > 0 && b > a ? Math.floor((b - Math.floor(startMin)) / interval) - Math.floor((a - Math.floor(startMin)) / interval) : 0;

  function solve(t: number, e: number): number {
    if (t >= horizon) return 0;
    const key = `${t}|${e}`;
    const hit = memo.get(key);
    if (hit !== undefined) return hit;
    // Wait one minute (regen on the clock).
    let best = solve(t + 1, Math.min(cap, e + gainBetween(t, t + 1)));
    const mult = multiplierAt(config.windows, config.multiplierMode, t);
    for (const task of config.tasks) {
      const d = Math.max(0, Math.floor(task.durationMin));
      if (task.energyCost > 0 && task.energyCost <= e) {
        const e2 = Math.min(cap, e - task.energyCost + gainBetween(t, Math.min(t + d, horizon)));
        best = Math.max(best, task.baseTickets * mult + solve(t + d, e2));
      }
    }
    memo.set(key, best);
    return best;
  }

  return solve(Math.floor(startMin), Math.min(cap, Math.floor(energy)));
}

describe("optimizer: DP vs brute-force reference", () => {
  it("matches the exhaustive reference on 300 randomized small events", () => {
    const rng = new Rng(12345);
    let compared = 0;
    for (let i = 0; i < 300; i++) {
      const config = randomConfig(rng, { small: true });
      const start = rng.int(0, Math.floor(config.durationMin / 2));
      const energy = rng.int(0, config.energyCap);
      const dp = optimizeDp({ config, nowMin: start, energy });
      const ref = bruteForce(config, start, energy);
      expect(dp.bestTickets).toBeCloseTo(ref, 6);
      compared++;
    }
    expect(compared).toBe(300);
  });

  it("DP is never worse than the greedy baseline (200 randomized events)", () => {
    const rng = new Rng(999);
    for (let i = 0; i < 200; i++) {
      const config = randomConfig(rng);
      const start = rng.int(0, Math.floor(config.durationMin / 3));
      const energy = rng.int(0, config.energyCap);
      const dp = optimizeDp({ config, nowMin: start, energy });
      const greedy = optimizeGreedy({ config, nowMin: start, energy });
      expect(dp.bestTickets + 1e-9).toBeGreaterThanOrEqual(greedy);
    }
  });

  it("prefers executing during Party Time when waiting pays", () => {
    const config = randomConfig(new Rng(1));
    config.tasks = [
      { id: "a", name: "A", nameAr: "أ", energyCost: 2, durationMin: 1, baseTickets: 10, repeatable: true, confidence: config.tasks[0].confidence },
    ];
    config.energyCap = 2;
    config.regenIntervalMin = 1000; // no useful regen
    config.durationMin = 60;
    config.windows = [
      { id: "p", kind: "party_time", startMin: 10, endMin: 30, multiplier: 3, confidence: config.tasks[0].confidence },
    ];
    const dp = optimizeDp({ config, nowMin: 0, energy: 2 });
    // Doing the task at minute 0 gives 10; waiting for party time gives 30.
    expect(dp.bestTickets).toBe(30);
    // Any minute inside the window is optimal; ties break toward waiting.
    expect(dp.steps[0].atMin).toBeGreaterThanOrEqual(10);
    expect(dp.steps[0].atMin).toBeLessThan(30);
    expect(dp.steps[0].multiplier).toBe(3);
  });

  it("handles zero energy with no regen: no steps, zero tickets", () => {
    const config = randomConfig(new Rng(7));
    config.regenIntervalMin = 100000;
    const dp = optimizeDp({ config, nowMin: 0, energy: 0 });
    expect(dp.bestTickets).toBe(0);
    expect(dp.steps).toHaveLength(0);
  });

  it("handles expired event (nowMin beyond duration)", () => {
    const config = randomConfig(new Rng(8));
    const dp = optimizeDp({ config, nowMin: config.durationMin + 50, energy: config.energyCap });
    expect(dp.bestTickets).toBe(0);
  });

  it("every planned step carries an explanation", () => {
    const rng = new Rng(55);
    const config = randomConfig(rng);
    const dp = optimizeDp({ config, nowMin: 0, energy: config.energyCap });
    for (const s of dp.steps) {
      expect(s.reason.length).toBeGreaterThan(0);
      expect(s.reasonAr.length).toBeGreaterThan(0);
    }
  });

  it("respects maxExecutions caps", () => {
    const config = randomConfig(new Rng(3));
    config.tasks = [
      { id: "lim", name: "L", nameAr: "ل", energyCost: 1, durationMin: 1, baseTickets: 100, repeatable: true, maxExecutions: 2, confidence: config.tasks[0].confidence },
    ];
    config.energyCap = 10;
    config.durationMin = 10;
    config.regenIntervalMin = 10000;
    config.windows = [];
    const dp = optimizeDp({ config, nowMin: 0, energy: 10 });
    expect(dp.steps.filter((s) => s.taskId === "lim")).toHaveLength(2);
    expect(dp.bestTickets).toBe(200);
  });
});
