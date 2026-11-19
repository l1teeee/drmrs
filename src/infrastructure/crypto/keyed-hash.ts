import { createHmac } from "node:crypto";

import { getEnv } from "../config/env";

export function keyedHash(value: string): string {
  return createHmac("sha256", getEnv().APP_SECRET).update(value).digest("hex");
}
