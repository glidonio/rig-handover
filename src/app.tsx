import { Hono } from 'hono';
import { loadConfig, type RigConfig } from './config.js';
import { lane } from './lane.js';
import { readNight } from './digest/read.js';
import { readStatus } from './status.js';
import { DigestTable } from './views/digest.js';
import { Layout } from './views/layout.js';
import { StatusBoard } from './views/status.js';

export function createApp(config: RigConfig = loadConfig()) {
  const app = new Hono();

  app.get('/health', (c) => c.json({ ok: true, lane: lane().id }));

  app.get('/', (c) =>
    c.html(
      <Layout title="status" lane={lane()}>
        <StatusBoard status={readStatus(config)} />
      </Layout>,
    ),
  );

  app.get('/digest/:night', (c) => {
    const reading = readNight(config.runsDir, c.req.param('night'));
    if (!reading) return c.notFound();
    return c.html(
      <Layout title={`digest ${reading.night}`} lane={lane()}>
        <DigestTable reading={reading} />
      </Layout>,
    );
  });

  // Same source as the digest page: the JSON is the reading itself, so the two cannot disagree.
  app.get('/api/digest/:night', (c) => {
    const reading = readNight(config.runsDir, c.req.param('night'));
    if (!reading) return c.json({ error: 'no run log for this night' }, 404);
    return c.json(reading);
  });

  return app;
}
