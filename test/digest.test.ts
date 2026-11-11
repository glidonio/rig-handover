import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/read.js';

// runs/ is read-only. Only the real night is read from there; every other case gets a temp dir.
describe('readNight on runs/2026-10-28.jsonl', () => {
  it('returns one row per job, sorted by job, and counts the bad line', () => {
    const reading = readNight('runs', '2026-10-28');
    expect(reading).not.toBeNull();
    expect(reading!.badLines).toBe(1);
    expect(reading!.rows.map((r) => r.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
  });

  it('fills every field of each row', () => {
    const rows = readNight('runs', '2026-10-28')!.rows;
    const byJob = Object.fromEntries(rows.map((r) => [r.job, r]));
    expect(byJob['lane/sync']).toEqual({
      job: 'lane/sync',
      owner: 'rook',
      runs: 8,
      retries: 1,
      lastStatus: 'ok',
      lastError: 'lock held',
      firstAt: '2026-10-28T23:00:06+01:00',
      lastAt: '2026-10-29T05:00:04+01:00',
    });
    expect(byJob['fixtures/refresh']).toEqual({
      job: 'fixtures/refresh',
      owner: 'rook',
      runs: 4,
      retries: 3,
      lastStatus: 'ok',
      lastError: 'upstream 503',
      firstAt: '2026-10-29T01:30:00+01:00',
      lastAt: '2026-10-29T01:37:00+01:00',
    });
    expect(byJob['notes/backup']).toMatchObject({ owner: 'lane-07', runs: 1, retries: 0, lastStatus: 'fail', lastError: 'quota exceeded' });
    expect(byJob['rig/rotate-logs']).toMatchObject({ owner: 'lane-07', runs: 1, lastStatus: 'ok', lastError: null });
  });

  it('keeps a row with owner null', () => {
    const row = readNight('runs', '2026-10-28')!.rows.find((r) => r.job === 'digest/render');
    expect(row).toMatchObject({ owner: null, runs: 1, lastStatus: 'ok', lastError: null });
  });
});

describe('readNight edge cases (temp runs dir)', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'rig-digest-'));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  const write = (night: string, body: string) => writeFileSync(join(dir, `${night}.jsonl`), body);

  it('returns null for a night with no file', () => {
    expect(readNight(dir, '2026-01-01')).toBeNull();
  });

  it('returns null for a night that is not YYYY-MM-DD', () => {
    write('2026-10-28', '{"at":"2026-10-28T01:00:00+01:00","job":"a","status":"ok","owner":"x"}\n');
    expect(readNight(dir, '../2026-10-28')).toBeNull();
    expect(readNight(dir, '2026-10-28.jsonl')).toBeNull();
  });

  it('renders an empty file with no rows', () => {
    write('2026-10-28', '');
    expect(readNight(dir, '2026-10-28')).toEqual({ night: '2026-10-28', rows: [], badLines: 0, counts: { ok: 0, retry: 0, fail: 0 } });
  });

  it('counts lines that do not parse or break the schema, and never throws', () => {
    write(
      '2026-10-28',
      [
        '{"at":"2026-10-28T01:00:00+01:00","job":"a","status":"ok","owner":"x"}',
        'not json',
        '{"at":"2026-10-28T01:00:00+01:00","job":"a","status":"maybe","owner":"x"}',
        '{"at":"nope","job":"a","status":"ok","owner":"x"}',
        '{"at":"2026-10-28T02:00:00+01:00","job":"a","status":"retry","owner":"x","error":"boom"}',
        '',
      ].join('\n'),
    );
    const reading = readNight(dir, '2026-10-28')!;
    expect(reading.badLines).toBe(3);
    expect(reading.rows).toHaveLength(1);
    expect(reading.rows[0]).toMatchObject({ job: 'a', runs: 2, retries: 1, lastStatus: 'retry', lastError: 'boom' });
  });

  it('shows owner null when no line of the job names one', () => {
    write('2026-10-28', '{"at":"2026-10-28T01:00:00+01:00","job":"b","status":"fail","owner":null,"error":"x"}\n');
    expect(readNight(dir, '2026-10-28')!.rows[0].owner).toBeNull();
  });
});
