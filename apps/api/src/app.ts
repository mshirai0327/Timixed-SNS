import { Hono } from "hono";
import { cors } from "hono/cors";
import { z } from "zod";

import { requireUser } from "./lib/auth";
import { createDrift, getTimeline } from "./lib/drifts";
import { toErrorResponse } from "./lib/errors";

const createDriftSchema = z.object({
  body: z.string(),
});

export const app = new Hono();

app.use(
  "/api/*",
  cors({
    origin: "*",
    allowHeaders: ["Authorization", "Content-Type", "X-Session-Seed"],
    allowMethods: ["GET", "POST", "OPTIONS"],
  }),
);

app.get("/health", (c) =>
  c.json({
    status: "ok",
  }),
);

app.get("/api/v1/timeline", async (c) => {
  const user = await requireUser(c);
  const timeline = await getTimeline(
    user.id,
    c.req.query("limit"),
    c.req.query("offset"),
    c.req.header("x-session-seed"),
  );

  return c.json(timeline);
});

app.post("/api/v1/drifts", async (c) => {
  const user = await requireUser(c);
  const payload = createDriftSchema.parse(await c.req.json());
  const drift = await createDrift(user.id, payload.body);

  return c.json(drift, 201);
});

app.notFound((c) =>
  c.json(
    {
      error: {
        code: "DRIFT_NOT_FOUND",
        message: "The requested resource does not exist.",
      },
    },
    404,
  ),
);

app.onError((error, c) => {
  const response = toErrorResponse(error);
  return c.json(response.body, response.status as 400 | 401 | 403 | 404 | 429 | 500);
});

