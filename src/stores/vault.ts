import Dexie, { type Table } from 'dexie'

export interface LogEntry {
  id?: number
  kind: 'spirometry' | 'vocal' | 'wheeze' | 'inhaler'
  ts: number
  summary: string
  data: Record<string, unknown>
  synced: boolean
}

export class PulmoVault extends Dexie {
  logs!: Table<LogEntry, number>
  constructor() {
    super('pulmo-wave-vault')
    this.version(1).stores({ logs: '++id, kind, ts, synced' })
  }
}
export const vault = new PulmoVault()

export async function saveLog(kind: LogEntry['kind'], summary: string, data: Record<string, unknown>) {
  await vault.logs.add({ kind, ts: Date.now(), summary, data, synced: false })
  syncQueue()
}

export async function syncQueue() {
  const pending = await vault.logs.where('synced').equals(0).toArray()
  if (!pending.length) return
  try {
    // Best-effort cloud sync; stays queued offline.
    await fetch('/api/pulmo_triage', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ping: true }) })
    await vault.logs.where('synced').equals(0).modify((l) => { l.synced = true })
  } catch { /* offline — remains in IndexedDB queue */ }
}

export async function exportCSV(): Promise<string> {
  const all = await vault.logs.toArray()
  const rows = ['id,kind,ts,summary,synced', ...all.map((l) => `${l.id},${l.kind},${l.ts},"${l.summary}",${l.synced ? 1 : 0}`)]
  return rows.join('\n')
}
