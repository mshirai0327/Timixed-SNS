import { serve } from "@hono/node-server";

import { app } from "./app";
import { config } from "./config";
import { connectCache, closeCache } from "./lib/cache";
import { closeDatabase } from "./lib/db";
import { runMigrations } from "./lib/migrations";

async function bootstrap() {
  await runMigrations();
  await connectCache();

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
