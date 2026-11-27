import { Action, EventConfig, MultiplierWindow, Plan, PlanStep, TaskDef } from "./types";

/**
 * Smart Energy Optimizer.
 *
 * Time-dependent dynamic programming over (minute, energy):
 *   V(t, e) = max(
 *     V(t+1, regen(e)),                                        // wait one minute
 *     reward_k * mult(t) + V(t + d_k, e - cost_k)  for each k  // do task k
 *   )
 * Tasks take d_k minutes. Backward DP: V(t + d_k) for d_k >= 1 is already
 * final when minute t is computed; d_k = 0 tasks recurse within the same
 * minute on smaller e only, so each minute is solved with e ascending.
 *
 * The DP is exact for the modeled rules: it maximizes total tickets, prefers
 * Party Time / boost windows when that pays, and wastes no regen energy
 * unless capacity forces it. Batteries are recommended by a documented
 * heuristic on top of the DP (see batteryAdvice) to keep the state space 2D.
 */

export interface OptimizerInput {
  config: EventConfig;
  /** Minutes since event start. */
  nowMin: number;
  /** Current basic energy (integer). */
  energy: number;
  /** Plan at most this many minutes ahead (absolute minute). */
  horizonMin?: number;
  /** taskId -> times already executed (for maxExecutions caps). */
  executions?: Record<string, number>;
  /**
   * Minutes already accrued toward the next regen point. Critical for
   * correctness: without it the model's regen clock drifts from the real one.
   */
  regenProgressMin?: number;
}

export function multiplierAt(windows: MultiplierWindow[], mode: "multiply" | "max", min: number): number {
  const active = windows.filter((w) => w.startMin <= min && min < w.endMin);
  if (active.length === 0) return 1;
  if (mode === "max") return Math.max(...active.map((w) => w.multiplier));
  return active.reduce((m, w) => m * w.multiplier, 1);
}

export function nextWindowStart(windows: MultiplierWindow[], nowMin: number): number | null {
  const future = windows.filter((w) => w.endMin > nowMin).map((w) => Math.max(w.startMin, nowMin));
  return future.length ? Math.min(...future) : null;
}

/**
 * Regen is clock-driven: actions are instantaneous, so regen progress at
 * minute t is always (t - start) mod interval. That makes the DP state 2D
 * and exactly equal to a forward brute force over (t, e).
 */
function regenGainAt(t: number, start: number, interval: number): 0 | 1 {
  return interval > 0 && (t + 1 - start) % interval === 0 ? 1 : 0;
}

/** Regen points earned on the clock between minute a (exclusive) and b (inclusive). */
function regenGainBetween(a: number, b: number, start: number, interval: number): number {
  if (interval <= 0 || b <= a) return 0;
  return Math.floor((b - start) / interval) - Math.floor((a - start) / interval);
}

export interface DpResult {
  /** Optimal expected tickets from (nowMin, energy). */
  bestTickets: number;
  /** Reconstructed action sequence. */
  steps: PlanStep[];
}

/**
 * Exact DP. Granularity is one minute; regen progress is tracked
 * deterministically from an initial fractional progress of 0, which the
 * caller can shift by passing nowMin aligned to the regen clock.
 */
export function optimizeDp(input: OptimizerInput): DpResult {
  const { config } = input;
  const horizon = Math.min(input.horizonMin ?? config.durationMin, config.durationMin);
  const start = Math.max(0, Math.floor(input.nowMin));
  const T = Math.max(start, Math.floor(horizon));
  const cap = config.energyCap;
  const interval = config.regenIntervalMin;
  // Regen clock origin: points land at minutes u where (u - clock0) % interval === 0.
  const clock0 = start - (input.regenProgressMin ?? 0);

  const tasks = config.tasks.map((t) => ({
    def: t,
    remaining: t.maxExecutions !== undefined ? Math.max(0, t.maxExecutions - (input.executions?.[t.id] ?? 0)) : Infinity,
  }));

  const W = cap + 1;
  const values: Array<Float64Array> = []; // values[t - start][e]
  const choice: Array<Int16Array> = []; // choice[t - start][e]: -1 wait, else task index
  values[T - start] = new Float64Array(W); // V(T, .) = 0

  for (let t = T - 1; t >= start; t--) {
    const cur = new Float64Array(W);
    const ch = new Int16Array(W).fill(-1);
    const mult = multiplierAt(config.windows, config.multiplierMode, t);
    const gain = regenGainAt(t, clock0, interval);
    const next = values[t + 1 - start];
    for (let e = 0; e <= cap; e++) {
      // Wait one minute (regen applies on the clock, cap may waste it).
      let best = next[Math.min(cap, e + gain)];
      let bestChoice = -1;
      // Do a task now.
      for (let k = 0; k < tasks.length; k++) {
        const { def } = tasks[k];
        if (def.energyCost <= 0 || def.energyCost > e) continue;
        const d = Math.max(0, Math.floor(def.durationMin));
        // Tickets count at action start, so a task may cross the horizon;
        // regen accrues only until the horizon (matches the simulator).
        const e2 = Math.min(cap, e - def.energyCost + regenGainBetween(t, Math.min(t + d, T), clock0, interval));
        // d = 0: same-minute recursion on already-final smaller e.
        // d >= 1: V(t+d, .) was finalized in an earlier (later-minute) pass.
        const cont = t + d >= T ? 0 : d === 0 ? cur[e2] : values[t + d - start][e2];
        const cand = def.baseTickets * mult + cont;
        if (cand > best + 1e-9) {
          best = cand;
          bestChoice = k;
        }
      }
      cur[e] = best;
      ch[e] = bestChoice;
    }
    values[t - start] = cur;
    choice[t - start] = ch;
  }

  // Reconstruct the plan by walking the recorded choices. maxExecutions
  // caps are enforced here (the DP valuation treats tasks as repeatable;
  // see docs/LIMITATIONS.md).
  const steps: PlanStep[] = [];
  let e = Math.min(cap, Math.floor(input.energy));
  let total = 0;
  const remaining = tasks.map((t) => t.remaining);
  for (let t = start; t < T; t++) {
    const ch = choice[t - start];
    if (!ch) break;
    const pick = ch[e];
    if (pick >= 0 && remaining[pick] > 0) {
      const def = tasks[pick].def;
      const mult = multiplierAt(config.windows, config.multiplierMode, t);
      const gained = def.baseTickets * mult;
      steps.push({
        type: "do_task",
        taskId: def.id,
        atMin: t,
        expectedTickets: gained,
        multiplier: mult,
        reason: explain(def, mult, config.windows, t),
        reasonAr: explainAr(def, mult, t),
      });
      total += gained;
      const d = Math.max(0, Math.floor(def.durationMin));
      e = Math.min(cap, e - def.energyCost + regenGainBetween(t, Math.min(t + d, T), clock0, interval));
      if (remaining[pick] !== Infinity) remaining[pick] -= 1;
      t += d - 1; // the loop's t++ finishes the advance (d=0 stays at t)
      continue;
    }
    e = Math.min(cap, e + regenGainAt(t, clock0, interval));
  }

  return { bestTickets: total, steps };
}

function explain(def: TaskDef, mult: number, windows: MultiplierWindow[], t: number): string {
  if (mult > 1) {
    const w = windows.find((w) => w.startMin <= t && t < w.endMin);
    const kind = w?.kind === "party_time" ? "Party Time" : "boost";
    return `${def.name} during ${kind} (x${mult}): ${def.baseTickets * mult} tickets for ${def.energyCost} energy`;
  }
  return `${def.name}: ${def.baseTickets} tickets for ${def.energyCost} energy (best available ratio now)`;
}

function explainAr(def: TaskDef, mult: number, t: number): string {
  if (mult > 1) {
    return `${def.nameAr} أثناء مضاعفة x${mult}: ${def.baseTickets * mult} تذكرة مقابل ${def.energyCost} طاقة (الدقيقة ${t})`;
  }
  return `${def.nameAr}: ${def.baseTickets} تذكرة مقابل ${def.energyCost} طاقة (أفضل نسبة متاحة الآن)`;
}

/**
 * Greedy baseline used as a comparison strategy: always do the available
 * task with the best tickets-per-energy ratio immediately.
 */
export function optimizeGreedy(input: OptimizerInput): number {
  const { config } = input;
  const horizon = Math.min(input.horizonMin ?? config.durationMin, config.durationMin);
  let e = Math.floor(input.energy);
  let total = 0;
  const start = Math.floor(input.nowMin);
  const clock0 = start - (input.regenProgressMin ?? 0);
  const remaining = config.tasks.map((t) =>
    t.maxExecutions !== undefined ? Math.max(0, t.maxExecutions - (input.executions?.[t.id] ?? 0)) : Infinity,
  );
  let t = start;
  while (t < horizon) {
    const mult = multiplierAt(config.windows, config.multiplierMode, t);
    let bestK = -1;
    let bestRatio = 0;
    for (let k = 0; k < config.tasks.length; k++) {
      const def = config.tasks[k];
      if (def.energyCost <= 0 || def.energyCost > e || remaining[k] <= 0) continue;
      const ratio = (def.baseTickets * mult) / def.energyCost;
      if (ratio > bestRatio) {
        bestRatio = ratio;
        bestK = k;
      }
    }
    if (bestK < 0) {
      // Wait one minute; regen applies on the clock.
      e = Math.min(config.energyCap, e + regenGainAt(t, clock0, config.regenIntervalMin));
      t += 1;
    } else {
      const def = config.tasks[bestK];
      const d = Math.max(0, Math.floor(def.durationMin));
      e = Math.min(config.energyCap, e - def.energyCost + regenGainBetween(t, Math.min(t + d, horizon), clock0, config.regenIntervalMin));
      total += def.baseTickets * mult;
      if (remaining[bestK] !== Infinity) remaining[bestK] -= 1;
      t += d; // d = 0 chains at the same minute
    }
  }
  return total;
}

/**
 * Battery heuristic (documented, not part of the exact DP):
 * use a battery when basic energy cannot afford the cheapest task, tasks
 * remain, and either a multiplier window is active or the event is ending
 * soon enough that stored energy would otherwise be wasted.
 */
export function batteryAdvice(
  config: EventConfig,
  nowMin: number,
  energy: number,
  batteries: number,
): Action | null {
  if (batteries <= 0) return null;
  const cheapest = Math.min(...config.tasks.map((t) => t.energyCost).filter((c) => c > 0));
  if (!Number.isFinite(cheapest) || energy >= cheapest) return null;
  const mult = multiplierAt(config.windows, config.multiplierMode, nowMin);
  const minutesLeft = config.durationMin - nowMin;
  const regenWillCover = minutesLeft * (1 / config.regenIntervalMin) >= cheapest - energy;
  if (mult > 1 || !regenWillCover) {
    return {
      type: "use_battery",
      atMin: nowMin,
      reason: mult > 1
        ? `Energy below cheapest task (${cheapest}) during a x${mult} window: spend a battery now`
        : `Event ends in ${minutesLeft}m and regen will not reach ${cheapest} energy: spend a battery before it is wasted`,
      reasonAr: mult > 1
        ? `الطاقة أقل من أرخص مهمة (${cheapest}) أثناء مضاعفة x${mult}: استخدم بطارية الآن`
        : `الإيفنت ينتهي بعد ${minutesLeft} دقيقة والتجدد لن يصل إلى ${cheapest} طاقة: استخدم بطارية قبل أن تضيع`,
    };
  }
  return null;
}

export function buildPlan(input: OptimizerInput, notes: string[] = []): Plan {
  const dp = optimizeDp(input);
  return {
    steps: dp.steps,
    expectedTotalTickets: dp.bestTickets,
    generatedAtMin: input.nowMin,
    notes,
  };
}
