import { connection } from "next/server";

import { instrumentSerif } from "@/lib/fuentes";
import { log, safeErrorCode } from "@/infrastructure/observability/logger";
import { getPublicRegistrationCount } from "@/infrastructure/registration/public-registration-count";

type ContadorRegistrosProps = {
  dropId: string;
};

export async function ContadorRegistros({ dropId }: ContadorRegistrosProps) {
  await connection();
  let total: number;
  try {
    total = await getPublicRegistrationCount(dropId);
  } catch (error) {
    log("error", "public_count_failed", { code: safeErrorCode(error) });
    return null;
  }

  return (
    <p className={`mt-2 ${instrumentSerif.className} text-[16px] text-white/80`}>
      {total} en el registro
    </p>
  );
}
