import { Hono } from "hono";
import { cors } from "hono/cors";
import { z } from "zod";

import { optionalUser, requireUser } from "./lib/auth";
import { createDrift, getTimeline } from "./lib/drifts";
import { toErrorResponse } from "./lib/errors";
import { getSession, loginUser, registerUser } from "./lib/users";

const createDriftSchema = z.object({
  body: z.string(),
});

const registerSchema = z.object({
  email: z.string().email(),
  handle: z
    .string()
    .trim()
    .min(3)
    .max(32)
    .regex(/^[a-zA-Z0-9_]+$/, "handle may only contain letters, numbers, and underscores."),
  display_name: z.string().trim().min(1).max(50),
  password: z.string().min(8).max(128),
});

const loginSchema = z.object({
  login: z.string().trim().min(1).max(255),
  password: z.string().min(8).max(128),
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
    service: "TimixedDiary API",
  }),
);

app.post("/api/v1/auth/register", async (c) => {
  const payload = registerSchema.parse(await c.req.json());
  const session = await registerUser(payload);

  return c.json(session, 201);
});

app.post("/api/v1/auth/login", async (c) => {
  const payload = loginSchema.parse(await c.req.json());
  const session = await loginUser(payload);

  return c.json(session);
});

app.get("/api/v1/auth/me", async (c) => {
  const user = await requireUser(c);
  const session = await getSession(user.id);

  return c.json(session);
});

app.get("/api/v1/timeline", async (c) => {
  const user = await optionalUser(c);
  const timeline = await getTimeline(
    user?.id ?? null,
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
  return c.json(response.body, response.status as 400 | 401 | 403 | 404 | 409 | 429 | 500);
});
