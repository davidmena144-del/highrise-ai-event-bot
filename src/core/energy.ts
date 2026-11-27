import { EnergyState, EventConfig } from "./types";

/**
 * Energy Manager: tracks basic energy, regeneration, capacity, batteries
 * (stored energy) and bonus energy with expiration.
 *
 * Time is modeled in minutes since event start. All mutation goes through
 * explicit methods so the auto player and simulator stay in lockstep.
 */
export class EnergyManager {
  constructor(
    public state: EnergyState,
    private config: EventConfig,
  ) {}

  static initial(config: EventConfig, startingEnergy: number): EnergyManager {
    return new EnergyManager(
      {
        basic: Math.min(startingEnergy, config.energyCap),
        batteries: 0,
        bonus: [],
        regenProgressMin: 0,
      },
      config,
    );
  }

  /** Advance regeneration. Returns how many points were regenerated. */
  tick(elapsedMin: number): number {
    if (elapsedMin <= 0) return 0;
    this.state.regenProgressMin += elapsedMin;
    const interval = this.config.regenIntervalMin;
    let gained = 0;
    while (this.state.regenProgressMin >= interval && interval > 0) {
      this.state.regenProgressMin -= interval;
      if (this.state.basic < this.config.energyCap) {
        this.state.basic += 1;
        gained += 1;
      }
      // At cap, regen progress still cycles: energy over cap is wasted.
    }
    return gained;
  }

  /** Total spendable energy right now (basic + non-expired bonus). */
  available(nowMin: number): number {
    this.expireBonus(nowMin);
    return this.state.basic + this.state.bonus.reduce((s, b) => s + b.amount, 0);
  }

  /** Drop expired bonus chunks. Returns how much expired (wasted). */
  expireBonus(nowMin: number): number {
    let expired = 0;
    this.state.bonus = this.state.bonus.filter((b) => {
      if (b.expiresAtMin !== null && b.expiresAtMin <= nowMin) {
        expired += b.amount;
        return false;
      }
      return true;
    });
    return expired;
  }

  /**
   * Spend energy, consuming soonest-expiring bonus first, then basic.
   * Returns false when there is not enough energy.
   */
  spend(amount: number, nowMin: number): boolean {
    if (amount < 0) throw new Error("Cannot spend a negative amount of energy");
    this.expireBonus(nowMin);
    let remaining = amount;
    this.state.bonus.sort((a, b) => (a.expiresAtMin ?? Infinity) - (b.expiresAtMin ?? Infinity));
    for (const b of this.state.bonus) {
      if (remaining <= 0) break;
      const take = Math.min(b.amount, remaining);
      b.amount -= take;
      remaining -= take;
    }
    this.state.bonus = this.state.bonus.filter((b) => b.amount > 0);
    if (remaining > this.state.basic) return false;
    this.state.basic -= remaining;
    return true;
  }

  /** Use one battery: converts stored energy into basic energy, honoring the cap. */
  useBattery(): boolean {
    if (this.state.batteries <= 0) return false;
    this.state.batteries -= 1;
    this.state.basic = Math.min(this.config.energyCap, this.state.basic + this.config.batteryEnergy);
    return true;
  }

  addBattery(count = 1): void {
    this.state.batteries += count;
  }

  addBonus(amount: number, expiresAtMin: number | null, id: string): void {
    if (amount <= 0) return;
    this.state.bonus.push({ id, amount, expiresAtMin });
  }

  snapshot(): EnergyState {
    return {
      basic: this.state.basic,
      batteries: this.state.batteries,
      bonus: this.state.bonus.map((b) => ({ ...b })),
      regenProgressMin: this.state.regenProgressMin,
    };
  }
}
