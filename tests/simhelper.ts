import { EventConfig, SimConfig } from "../src/core";

export function simCfg(event: EventConfig, seed: number, patch: Partial<SimConfig> = {}): SimConfig {
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
