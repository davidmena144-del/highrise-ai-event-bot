import { CapabilityEntry, EventConfig, PlayerState, UnsupportedCapabilityError } from "../types";
import { ExecuteResult, GameAdapter } from "./base";

/**
 * Official Adapter: the seam for a future officially authorized Highrise
 * integration. As of November 2026 the official surfaces are:
 *
 * - Web API (https://create.highrise.game/learn/web-api/general/overview):
 *   public, read-only data (users, rooms, posts, items, grabs). No auth, no
 *   writes, no event/energy/task endpoints.
 * - Bot API / Python SDK (https://create.highrise.game/learn/bots/guides/creating-a-bot):
 *   bots are separate accounts that join rooms the bot owner controls. It
 *   offers room interactions (chat, emotes, movement, moderation), not
 *   player-account event play, energy or tasks.
 *
 * Neither surface lets a third party read or control a player's event
 * energy, tasks, or actions. So every method here fails safely with
 * UnsupportedCapabilityError instead of pretending to work.
 */
export class OfficialAdapter implements GameAdapter {
  readonly kind = "official" as const;

  private fail<T>(capability: string): T {
    throw new UnsupportedCapabilityError(
      capability,
      `"${capability}" is not available through any official Highrise API. ` +
        "The Web API is read-only public data and the Bot API controls room bots, not player accounts. " +
        "Use the Manual adapter (user-confirmed data) or the Simulator adapter instead.",
    );
  }

  getConfig(): EventConfig {
    return this.fail("Read event information");
  }

  getState(): PlayerState {
    return this.fail("Read energy/tasks");
  }

  advance(): void {
    // No-op: there is no official clock to advance.
  }

  doTask(): ExecuteResult {
    return {
      ok: false,
      ticketsEarned: 0,
      error: "Executing event actions is not supported by any official Highrise API.",
      recommendation: "Open the official Highrise app and perform the action yourself.",
      recommendationAr: "افتح تطبيق هاي رايز الرسمي ونفّذ الإجراء بنفسك.",
    };
  }

  useBattery(): ExecuteResult {
    return {
      ok: false,
      ticketsEarned: 0,
      error: "Using batteries is not supported by any official Highrise API.",
      recommendation: "Use the battery inside the official Highrise app.",
      recommendationAr: "استخدم البطارية من جوه تطبيق هاي رايز الرسمي.",
    };
  }

  capabilities(): CapabilityEntry[] {
    const webApi = "https://create.highrise.game/learn/web-api/general/overview";
    const botApi = "https://create.highrise.game/learn/bots/guides/creating-a-bot";
    return [
      { capability: "User authentication", available: false, officialSource: botApi, limitations: "Bot tokens authenticate room bots only; no player-account OAuth for third parties" },
      { capability: "Read event information", available: false, officialSource: webApi, limitations: "No event endpoints; only users/rooms/posts/items/grabs" },
      { capability: "Read energy", available: false, officialSource: webApi, limitations: "No energy endpoint" },
      { capability: "Read tasks", available: false, officialSource: webApi, limitations: "No task endpoint" },
      { capability: "Execute event actions", available: false, officialSource: webApi, limitations: "Web API is read-only; no modification support" },
      { capability: "Collect rewards", available: false, officialSource: webApi, limitations: "No endpoint" },
      { capability: "Use additional energy", available: false, officialSource: webApi, limitations: "No endpoint" },
    ];
  }
}
