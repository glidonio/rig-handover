import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

// Route matrix for 2a (page) and 2b (JSON). Every case uses a temp runs dir; runs/ is never read here.
const base = { adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60 };
const at = '2026-10-28T23:00:00+01:00';
const ok = (job: string) => JSON.stringify({ at, job, status: 'ok', owner: 'rook' });

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'rig-digest-routes-'));
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

const app = () => createApp({ ...base, runsDir: dir });

describe('route tests: 200 with rows', () => {
  it('page and JSON answer 200 for a night with jobs', async () => {
    writeFileSync(join(dir, '2026-10-28.jsonl'), [ok('b/job'), ok('a/job')].join('\n'));
    const page = await app().request('/digest/2026-10-28');
    expect(page.status).toBe(200);
    const html = await page.text();
    expect(html.indexOf('a/job')).toBeLessThan(html.indexOf('b/job'));

    const api = await app().request('/api/digest/2026-10-28');
    expect(api.status).toBe(200);
    const body = await api.json();
    expect(body.rows.map((r: { job: string }) => r.job)).toEqual(['a/job', 'b/job']);
  });
});

describe('route tests: 404 for a night with no file', () => {
  it('page answers 404', async () => {
    expect((await app().request('/digest/2026-01-01')).status).toBe(404);
  });
  it('JSON answers 404 with an error body', async () => {
    const res = await app().request('/api/digest/2026-01-01');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'no run log for this night' });
  });
});

describe('route tests: empty night', () => {
  it('page answers 200 with "nothing ran"', async () => {
    writeFileSync(join(dir, '2026-10-28.jsonl'), '');
    const res = await app().request('/digest/2026-10-28');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('nothing ran');
  });
  it('JSON answers 200 with no rows and no bad lines', async () => {
    writeFileSync(join(dir, '2026-10-28.jsonl'), '');
    const res = await app().request('/api/digest/2026-10-28');
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ night: '2026-10-28', rows: [], badLines: 0 });
  });
});

describe('route tests: night with a bad line', () => {
  it('page answers 200, shows the good row and the bad line count', async () => {
    writeFileSync(join(dir, '2026-10-28.jsonl'), [ok('a/job'), 'not json'].join('\n'));
    const res = await app().request('/digest/2026-10-28');
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('a/job');
    expect(html).toContain('1 bad line(s)');
  });
  it('JSON answers 200, returns the good row and counts the bad line', async () => {
    writeFileSync(join(dir, '2026-10-28.jsonl'), [ok('a/job'), 'not json'].join('\n'));
    const res = await app().request('/api/digest/2026-10-28');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.rows.map((r: { job: string }) => r.job)).toEqual(['a/job']);
    expect(body.badLines).toBe(1);
  });
});
