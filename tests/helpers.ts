import { Confidence, EventConfig, Rng, TaskDef } from "../src/core";

/** Build a small randomized event config for property-style tests. */
export function randomConfig(rng: Rng, opts: { small?: boolean } = {}): EventConfig {
  const cap = opts.small ? rng.int(4, 12) : rng.int(10, 30);
  const taskCount = rng.int(1, 3);
  const tasks: TaskDef[] = Array.from({ length: taskCount }, (_, i) => ({
    id: `task-${i}`,
    name: `Task ${i}`,
    nameAr: `مهمة ${i}`,
    energyCost: rng.int(1, Math.max(2, Math.floor(cap / 2))),
    durationMin: rng.int(1, 3),
    baseTickets: rng.int(1, 20),
    repeatable: true,
    confidence: Confidence.ESTIMATED,
  }));
  const duration = opts.small ? rng.int(30, 120) : rng.int(240, 720);
  const windows = rng.chance(0.7)
    ? [
        {
          id: "party-0",
          kind: "party_time" as const,
          startMin: rng.int(0, Math.floor(duration / 2)),
          endMin: 0, // set below
          multiplier: 2,
          confidence: Confidence.ESTIMATED,
        },
      ]
    : [];
  if (windows.length) {
    windows[0].endMin = Math.min(duration, windows[0].startMin + rng.int(10, 30));
  }
  return {
    id: `evt-${rng.int(1, 1e6)}`,
    name: "Random Event",
    durationMin: duration,
    regenIntervalMin: rng.int(2, 10),
    energyCap: cap,
    tasks,
    windows,
    batteryEnergy: cap,
    multiplierMode: "multiply",
    confidence: Confidence.ESTIMATED,
  };
}

export { Rng };
