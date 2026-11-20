import { connection } from "next/server";

import { HojaExpediente } from "@/components/HojaExpediente";
import { getPublicCurrentDrop } from "@/infrastructure/drops/public-current-drop";
import { log, safeErrorCode } from "@/infrastructure/observability/logger";
import { toDropPublico } from "@/lib/drop-publico";

export async function HojaExpedienteActual() {
  await connection();
  let drop = null;
  try {
    drop = toDropPublico(await getPublicCurrentDrop());
  } catch (error) {
    log("error", "public_drop_failed", { code: safeErrorCode(error) });
  }

  return <HojaExpediente drop={drop} />;
}
