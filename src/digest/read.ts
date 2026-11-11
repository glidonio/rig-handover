import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DigestRow, NightReading, ReadNight, RunLine, RunStatus } from './types.js';

const NIGHT = /^\d{4}-\d{2}-\d{2}$/;
const STATUSES: readonly RunStatus[] = ['ok', 'retry', 'fail'];

// Parse one line. Returns null for anything that is not a valid run line.
function parseLine(text: string): RunLine | null {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof raw !== 'object' || raw === null) return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.at !== 'string' || Number.isNaN(Date.parse(o.at))) return null;
  if (typeof o.job !== 'string') return null;
  if (typeof o.status !== 'string' || !STATUSES.includes(o.status as RunStatus)) return null;
  if (o.owner !== null && typeof o.owner !== 'string' && o.owner !== undefined) return null;
  if (o.error !== undefined && typeof o.error !== 'string') return null;
  return {
    at: o.at,
    job: o.job,
    status: o.status as RunStatus,
    owner: typeof o.owner === 'string' ? o.owner : null,
    ...(typeof o.error === 'string' ? { error: o.error } : {}),
  };
}

export const readNight: ReadNight = (runsDir, night) => {
  if (!NIGHT.test(night)) return null;

  let text: string;
  try {
    text = readFileSync(join(runsDir, `${night}.jsonl`), 'utf8');
  } catch {
    return null;
  }

  const byJob = new Map<string, RunLine[]>();
  const counts: Record<RunStatus, number> = { ok: 0, retry: 0, fail: 0 };
  let badLines = 0;
  for (const line of text.split('\n')) {
    if (line.trim() === '') continue;
    const parsed = parseLine(line);
    if (!parsed) {
      badLines += 1;
      continue;
    }
    counts[parsed.status] += 1;
    const group = byJob.get(parsed.job) ?? [];
    group.push(parsed);
    byJob.set(parsed.job, group);
  }

  const rows: DigestRow[] = [...byJob.entries()]
    .map(([job, lines]) => toRow(job, lines))
    .sort((a, b) => (a.job < b.job ? -1 : a.job > b.job ? 1 : 0));

  const reading: NightReading = { night, rows, badLines, counts };
  return reading;
};

// Lines are read in file order; the log is append-only, so the last line is the newest.
function toRow(job: string, lines: RunLine[]): DigestRow {
  const byTime = [...lines].sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  const last = byTime[byTime.length - 1];
  const named = [...byTime].reverse().find((l) => l.owner !== null);
  const errored = [...byTime].reverse().find((l) => l.error !== undefined);
  return {
    job,
    owner: named ? named.owner : null,
    runs: lines.length,
    retries: lines.filter((l) => l.status === 'retry').length,
    lastStatus: last.status,
    lastError: errored ? (errored.error ?? null) : null,
    firstAt: byTime[0].at,
    lastAt: last.at,
  };
}
