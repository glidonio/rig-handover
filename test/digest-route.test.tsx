import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

// runs/ is read-only. The real night is read from runs/; every other case uses a temp dir.
let dir: string;
const config = (runsDir: string) => ({
  adapter: 'shim',
  installed: '2026-10-29T14:06:00+01:00',
  beatEverySeconds: 60,
  runsDir,
});

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'rig-digest-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

const line = (job: string, status: string, at: string, extra = '') =>
  JSON.stringify({ at, job, status, owner: 'rook', ...(extra ? { error: extra } : {}) });

describe('GET /digest/:night', () => {
  it('renders the real night from runs/ with 5 job rows in job order', async () => {
    const res = await createApp(config('runs')).request('/digest/2026-10-28');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('digest 2026-10-28');
    const jobs = [...html.matchAll(/<tr><td>([^<]+)<\/td>/g)].map((m) => m[1]);
    expect(jobs).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
  });

  it('returns 404 for a night with no file', async () => {
    const res = await createApp(config(dir)).request('/digest/2026-01-01');
    expect(res.status).toBe(404);
  });

  it('returns 404 for a malformed night', async () => {
    const res = await createApp(config(dir)).request('/digest/not-a-night');
    expect(res.status).toBe(404);
  });

  it('renders "nothing ran" for an empty file', async () => {
    writeFileSync(join(dir, '2026-02-02.jsonl'), '');
    const res = await createApp(config(dir)).request('/digest/2026-02-02');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('nothing ran');
    expect(html).not.toContain('<table>');
  });

  it('flags retries of 3 or more and a fail status, and shows a bad line count', async () => {
    const at = '2026-03-03T01:00:00+01:00';
    writeFileSync(
      join(dir, '2026-03-03.jsonl'),
      [
        line('a/flaky', 'retry', at),
        line('a/flaky', 'retry', at),
        line('a/flaky', 'retry', at),
        line('a/flaky', 'ok', at),
        line('b/broken', 'fail', at, 'boom'),
        line('c/calm', 'ok', at),
        'not json',
      ].join('\n'),
    );
    const res = await createApp(config(dir)).request('/digest/2026-03-03');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toMatch(/<td class="warn">3<\/td>/); // a/flaky retries
    expect(html).toMatch(/<td class="warn">fail<\/td>/); // b/broken last status
    expect(html).not.toMatch(/<td class="warn">0<\/td>/); // c/calm not flagged
    expect(html).toContain('1 bad line(s)');
  });
});
