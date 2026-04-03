import { serve } from "@hono/node-server";

import { app } from "./app";
import { config } from "./config";
import { connectCache, closeCache } from "./lib/cache";
import { closeDatabase } from "./lib/db";
import { runMigrations } from "./lib/migrations";

async function withRetry<T>(
  label: string,
  operation: () => Promise<T>,
  attempts = 20,
  delayMs = 1500,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (attempt === attempts) {
        break;
      }

      console.warn(`${label} failed (attempt ${attempt}/${attempts}), retrying...`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw lastError;
}

async function bootstrap() {
  await withRetry("database migrations", () => runMigrations());
  await withRetry("cache connection", () => connectCache(), 15, 1000);

  const server = serve(
    {
      fetch: app.fetch,
      port: config.PORT,
    },
    (info) => {
      console.log(`TimixedDiary API listening on http://localhost:${info.port}`);
    },
  );

  const shutdown = async () => {
    server.close();
    await closeCache();
    await closeDatabase();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

bootstrap().catch((error) => {
  console.error(error);
  process.exit(1);
});
