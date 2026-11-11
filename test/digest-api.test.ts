import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { readNight } from '../src/digest/read.js';

const base = { adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60 };

// runs/ is read-only. The real night is only read; every other case gets a temp dir.
describe('GET /api/digest/:night on runs/2026-10-28', () => {
  it('returns the same rows, in the same order, as the reader', async () => {
    const res = await createApp({ ...base, runsDir: 'runs' }).request('/api/digest/2026-10-28');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.rows.map((r: { job: string }) => r.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
    expect(body).toEqual(JSON.parse(JSON.stringify(readNight('runs', '2026-10-28'))));
    expect(body.badLines).toBe(1);
  });
});

describe('GET /api/digest/:night (temp runs dir)', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'rig-digest-api-'));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('answers 404 for a night with no file', async () => {
    const res = await createApp({ ...base, runsDir: dir }).request('/api/digest/2026-01-01');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'no run log for this night' });
  });

  it('answers 404 for a night that is not YYYY-MM-DD', async () => {
    const res = await createApp({ ...base, runsDir: dir }).request('/api/digest/..%2Fsecret');
    expect(res.status).toBe(404);
  });

  it('answers an empty night with no rows', async () => {
    writeFileSync(join(dir, '2026-10-28.jsonl'), '');
    const res = await createApp({ ...base, runsDir: dir }).request('/api/digest/2026-10-28');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ night: '2026-10-28', rows: [], badLines: 0 });
  });

  it('counts a bad line and still returns the good rows', async () => {
    writeFileSync(
      join(dir, '2026-10-28.jsonl'),
      [
        '{"at":"2026-10-28T01:00:00+01:00","job":"a","status":"ok","owner":"x"}',
        'not json',
        '',
      ].join('\n'),
    );
    const res = await createApp({ ...base, runsDir: dir }).request('/api/digest/2026-10-28');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.badLines).toBe(1);
    expect(body.rows.map((r: { job: string }) => r.job)).toEqual(['a']);
  });
});
