import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

import pg from "pg";

import {
  databaseSsl,
  isLocalDatabaseHost,
  parseDatabaseEnv,
} from "../src/infrastructure/config/database-env.ts";

export function validateMigrationTarget(environment) {
  const target = new URL(environment.DATABASE_URL);
  if (environment.DATABASE_SSL_MODE === "disable" && !isLocalDatabaseHost(target.hostname)) {
    throw new Error("DATABASE_SSL_MODE=disable solo se permite para una base de datos local");
  }
}

export async function migrateDatabase() {
  const environment = parseDatabaseEnv(process.env);
  validateMigrationTarget(environment);

  const client = new pg.Client({
    connectionString: environment.DATABASE_URL,
    connectionTimeoutMillis: 3_000,
    ssl: databaseSsl(environment),
  });
  let locked = false;

  try {
    await client.connect();
    await client.query("SELECT pg_advisory_lock(hashtext('drmr_migrations'))");
    locked = true;
    await client.query(
      "CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())",
    );

    const migrationsDirectory = new URL("../db/migrations/", import.meta.url);
    const names = (await readdir(migrationsDirectory))
      .filter((name) => /^\d{4}_[a-z0-9_]+\.sql$/.test(name))
      .sort();
    const applied = await client.query("SELECT name, checksum FROM schema_migrations");
    const checksums = new Map(applied.rows.map((row) => [row.name, row.checksum]));
    let appliedCount = 0;

    for (const name of names) {
      const rawSql = await readFile(new URL(name, migrationsDirectory), "utf8");
      const sql = rawSql.replace(/\r\n/g, "\n");
      const checksum = createHash("sha256").update(sql).digest("hex");

      if (checksums.has(name)) {
        if (checksums.get(name) !== checksum) {
          throw new Error(`migration changed after apply: ${name}`);
        }
        continue;
      }

      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query("INSERT INTO schema_migrations (name, checksum) VALUES ($1, $2)", [
          name,
          checksum,
        ]);
        await client.query("COMMIT");
      } catch (error) {
        try {
          await client.query("ROLLBACK");
        } catch {
          // keep the original migration error
        }
        throw error;
      }

      appliedCount += 1;
      console.log(`applied ${name}`);
    }

    if (appliedCount === 0) {
      console.log("migrations up to date");
    }
  } finally {
    try {
      if (locked) {
        await client.query("SELECT pg_advisory_unlock(hashtext('drmr_migrations'))");
      }
    } catch {
      // the lock is released when the session ends; keep the original error
    } finally {
      await client.end();
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  migrateDatabase().catch((error) => {
    const message = error instanceof Error ? error.message : "migration failed";
    console.error(message.replace(/postgres(?:ql)?:\/\/\S+/gi, "[redacted database URL]"));
    process.exitCode = 1;
  });
}
