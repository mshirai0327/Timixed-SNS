import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { config } from "../config.js";
import { sql } from "./db.js";

function resolveMigrationsDir() {
  const candidates = [
    config.MIGRATIONS_DIR,
    path.resolve(process.cwd(), "db/migrations"),
    path.resolve(process.cwd(), "../db/migrations"),
    path.resolve(process.cwd(), "../../db/migrations"),
    fileURLToPath(new URL("../../../../db/migrations", import.meta.url)),
    fileURLToPath(new URL("../../../../../../db/migrations", import.meta.url)),
  ].filter((value): value is string => Boolean(value));

  const matched = candidates.find((candidate) => existsSync(candidate));

  if (!matched) {
    throw new Error("Could not locate db/migrations. Set MIGRATIONS_DIR explicitly.");
  }

  return matched;
}

export async function runMigrations() {
  const migrationsDir = resolveMigrationsDir();

  await sql`
    create table if not exists schema_migrations (
      filename text primary key,
      applied_at timestamptz not null default now()
    )
  `;

  const filenames = (await readdir(migrationsDir))
    .filter((filename) => filename.endsWith(".sql"))
    .sort((left, right) => left.localeCompare(right));

  for (const filename of filenames) {
    const existing = await sql<{ filename: string }[]>`
      select filename
      from schema_migrations
      where filename = ${filename}
      limit 1
    `;

    if (existing.length > 0) {
      continue;
    }

    const filePath = path.join(migrationsDir, filename);
    const sqlText = await readFile(filePath, "utf8");

    await sql.unsafe(sqlText);
    await sql`
      insert into schema_migrations (filename)
      values (${filename})
    `;
  }
}
