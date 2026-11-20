import { connection } from "next/server";

import { formatDropNumber } from "@/domain/drop/drop";
import { getPublicCurrentDrop } from "@/infrastructure/drops/public-current-drop";
import { log, safeErrorCode } from "@/infrastructure/observability/logger";

type FolioArchivoProps = {
  className?: string;
};

export async function FolioArchivo({ className }: FolioArchivoProps) {
  await connection();
  let folio = "";
  try {
    const drop = await getPublicCurrentDrop();
    if (drop !== null) {
      folio = formatDropNumber(drop.number);
    }
  } catch (error) {
    log("error", "public_drop_failed", { code: safeErrorCode(error) });
  }

  return <span className={className}>{folio ? `Exp. ${folio}` : "Exp."}</span>;
}
