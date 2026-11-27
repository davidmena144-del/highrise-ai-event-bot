/**
 * Session Manager: logs, snapshots, recovery and storage isolation.
 *
 * Simulator sessions and real (manual) sessions live in separate storage
 * namespaces so simulated data can never be confused with real observations.
 */

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  keys(): string[];
}

export class MemoryStorage implements StorageLike {
  private map = new Map<string, string>();
  getItem(key: string): string | null {
    return this.map.has(key) ? this.map.get(key)! : null;
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
  keys(): string[] {
    return [...this.map.keys()];
  }
}

export type SessionNamespace = "sim" | "real";

export interface SessionSnapshot {
  sessionId: string;
  namespace: SessionNamespace;
  savedAtMin: number;
  adapterKind: string;
  autoPlayerState: string;
  playerState: unknown;
  logSize: number;
}

export interface SessionRecord {
  sessionId: string;
  namespace: SessionNamespace;
  startedAt: number;
  endedAt: number | null;
  summary: string;
}

const PREFIX = "hreb"; // highrise event bot

export class SessionManager {
  constructor(private storage: StorageLike) {}

  private key(ns: SessionNamespace, name: string): string {
    return `${PREFIX}:${ns}:${name}`;
  }

  saveSnapshot(ns: SessionNamespace, sessionId: string, snapshot: Omit<SessionSnapshot, "sessionId" | "namespace">): void {
    const full: SessionSnapshot = { sessionId, namespace: ns, ...snapshot };
    this.storage.setItem(this.key(ns, `snapshot:${sessionId}`), JSON.stringify(full));
  }

  loadSnapshot(ns: SessionNamespace, sessionId: string): SessionSnapshot | null {
    const raw = this.storage.getItem(this.key(ns, `snapshot:${sessionId}`));
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as SessionSnapshot;
      // Isolation guard: a snapshot is only valid inside its own namespace.
      if (parsed.namespace !== ns) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  deleteSnapshot(ns: SessionNamespace, sessionId: string): void {
    this.storage.removeItem(this.key(ns, `snapshot:${sessionId}`));
  }

  recordSession(record: SessionRecord): void {
    this.storage.setItem(this.key(record.namespace, `record:${record.sessionId}`), JSON.stringify(record));
  }

  listSessions(ns: SessionNamespace): SessionRecord[] {
    const prefix = this.key(ns, "record:");
    const out: SessionRecord[] = [];
    for (const k of this.storage.keys()) {
      if (!k.startsWith(prefix)) continue;
      try {
        const rec = JSON.parse(this.storage.getItem(k)!) as SessionRecord;
        if (rec.namespace === ns) out.push(rec);
      } catch {
        // Corrupt entry: ignore, never crash the session list.
      }
    }
    return out.sort((a, b) => b.startedAt - a.startedAt);
  }

  /** Assert at runtime that the two namespaces never share keys. */
  assertIsolation(): void {
    for (const k of this.storage.keys()) {
      if (!k.startsWith(`${PREFIX}:sim:`) && !k.startsWith(`${PREFIX}:real:`)) {
        throw new Error(`Storage key outside known namespaces: ${k}`);
      }
    }
  }
}
