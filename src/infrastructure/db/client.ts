import { Pool } from "pg";

import { getEnv } from "../config/env";
import { databaseSsl } from "../config/database-env";
import { log, safeErrorCode } from "../observability/logger";

let pool: Pool | undefined;

export function getPool(): Pool {
  if (pool) {
    return pool;
  }

  const environment = getEnv();
  pool = new Pool({
    connectionString: environment.DATABASE_URL,
    max: environment.DATABASE_POOL_MAX,
    idleTimeoutMillis: 5_000,
    connectionTimeoutMillis: 3_000,
    ssl: databaseSsl(environment),
  });

  pool.on("error", (error) => {
    log("error", "database_idle_client_error", { code: safeErrorCode(error) });
  });

  return pool;
}
