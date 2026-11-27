import { CapabilityEntry, Confidence, EventConfig } from "./types";

/**
 * Capability matrix, grounded in official Highrise documentation
 * (checked 2026-11-27). Never claim more than this.
 */
export const CAPABILITY_MATRIX: CapabilityEntry[] = [
  {
    capability: "User authentication",
    available: false,
    officialSource: "https://create.highrise.game/learn/bots/guides/creating-a-bot",
    limitations:
      "Bot API tokens authenticate room bots (separate bot accounts in rooms you own). No official OAuth/login for third-party control of a player account.",
  },
  {
    capability: "Read public profile/room data",
    available: true,
    officialSource: "https://create.highrise.game/learn/web-api/general/overview",
    limitations: "Public, read-only Web API: users, rooms, posts, items, grabs. No auth required. No writes.",
  },
  {
    capability: "Read event information",
    available: false,
    officialSource: "https://create.highrise.game/learn/web-api/general/overview",
    limitations: "No event endpoints documented.",
  },
  {
    capability: "Read energy",
    available: false,
    officialSource: "https://create.highrise.game/learn/web-api/general/overview",
    limitations: "No energy endpoint documented.",
  },
  {
    capability: "Read tasks",
    available: false,
    officialSource: "https://create.highrise.game/learn/web-api/general/overview",
    limitations: "No task endpoint documented.",
  },
  {
    capability: "Execute event actions",
    available: false,
    officialSource: "https://create.highrise.game/learn/web-api/general/overview",
    limitations: "Web API explicitly supports no data modification.",
  },
  {
    capability: "Collect rewards",
    available: false,
    officialSource: "https://create.highrise.game/learn/web-api/general/overview",
    limitations: "No endpoint documented.",
  },
  {
    capability: "Use additional energy",
    available: false,
    officialSource: "https://create.highrise.game/learn/web-api/general/overview",
    limitations: "No endpoint documented.",
  },
];

/**
 * Verified event mechanics, from official Highrise support articles
 * (checked 2026-11-27):
 * - support.highrise.game/en/articles/17758804 (how events work)
 * - support.highrise.game/en/articles/17758799 (event energy)
 * - support.highrise.game/en/articles/17758802 (tickets, scores, boosts)
 *
 * Numbers the support articles do NOT give (regen interval, party time
 * cadence, caps) come from community guides and stay ESTIMATED.
 */
export function defaultEventConfig(): EventConfig {
  return {
    id: "weekly-event",
    name: "Weekly Event",
    // VERIFIED: weekly events usually run 7 days (support 17758804).
    durationMin: 7 * 24 * 60,
    // ESTIMATED: community guides put regen near +1 per 4 minutes
    // (highrise.game/post/6aa126fc6f0bfc7889871fc4, MaIthaeI).
    regenIntervalMin: 4,
    // ESTIMATED: community reports; user should calibrate from the app.
    energyCap: 25,
    batteryEnergy: 25,
    multiplierMode: "multiply",
    confidence: Confidence.ESTIMATED,
    tasks: [
      {
        id: "main-action",
        name: "Main action (x1)",
        nameAr: "الإجراء الرئيسي (x1)",
        energyCost: 1,
        durationMin: 1,
        baseTickets: 10,
        repeatable: true,
        confidence: Confidence.ESTIMATED,
      },
      {
        id: "main-action-x3",
        name: "Main action (x3 multiplier)",
        nameAr: "الإجراء الرئيسي (مضاعف x3)",
        // VERIFIED mechanic (support 17758799): the action-button multiplier
        // spends more energy per action and multiplies its tickets.
        energyCost: 3,
        durationMin: 1,
        baseTickets: 30,
        repeatable: true,
        confidence: Confidence.VERIFIED,
      },
      {
        id: "daily-checkin",
        name: "Daily check-in",
        nameAr: "تسجيل الدخول اليومي",
        energyCost: 0,
        durationMin: 0,
        baseTickets: 50,
        repeatable: true,
        maxExecutions: 7,
        confidence: Confidence.ESTIMATED,
      },
    ],
    windows: [
      // ESTIMATED: community guides put Party Time roughly every 6 hours
      // (highrise.game/post/6aa126fc6f0bfc7889871fc4).
      ...Array.from({ length: 28 }, (_, i) => ({
        id: `party-${i}`,
        kind: "party_time" as const,
        startMin: i * 360,
        endMin: i * 360 + 30,
        multiplier: 2,
        confidence: Confidence.ESTIMATED,
      })),
    ],
  };
}
