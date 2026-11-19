import { connection } from "next/server";

import { log, safeErrorCode } from "@/infrastructure/observability/logger";
import { getPublicRegistrationCount } from "@/infrastructure/registration/public-registration-count";

export async function ContadorRegistros() {
  await connection();
  let total: number;
  try {
    total = await getPublicRegistrationCount();
  } catch (error) {
    log("error", "public_count_failed", { code: safeErrorCode(error) });
    return null;
  }

  return <p className="mt-2 font-mono text-[12px] text-white/80">{total} en el registro</p>;
}
