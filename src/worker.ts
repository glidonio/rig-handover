import { Hono } from "hono";

// Workers entry. Node-only modules (fs-based heartbeat, runs/ reader) are not
// used here: Workers have no local disk. Status data is inlined from rig.json.
const RIG = {
  adapter: "shim",
  installed: "2026-10-29T14:06:00+01:00",
  beatEverySeconds: 60,
};

type Env = {
  PING_KEY?: string;
  MODEL_KEY?: string;
};

const app = new Hono<{ Bindings: Env }>();

app.get("/", (c) => c.json({ service: "rig", status: "ok", ...RIG }));

app.get("/health", (c) => c.text("ok"));

// TODO: /.well-known/mega-pulse.json and the ping handler.
// Blocked until docs/course-api.md (in the course starter zip) is read.

export default app;
