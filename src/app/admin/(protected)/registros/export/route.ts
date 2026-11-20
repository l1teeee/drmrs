import { connection } from "next/server";
import { z } from "zod";

import { exportRegistros } from "@/application/admin-registros/admin-registros";
import { formatDropNumber } from "@/domain/drop/drop";
import { adminRegistrosDependencies } from "@/infrastructure/admin/admin-registros-runtime";
import { requireAdmin } from "@/infrastructure/auth/require-admin";
import { createCsv } from "@/infrastructure/http/csv";

export async function GET(request: Request) {
  await connection();
  const authorization = await requireAdmin("action");
  if (!authorization.ok) {
    return Response.json(
      { ok: false, error: "unauthorized" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  if (authorization.admin.role !== "OWNER") {
    return Response.json(
      { ok: false, error: "forbidden" },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  }

  const dependencies = adminRegistrosDependencies();
  const dropParam = new URL(request.url).searchParams.get("drop");
  const parsedDrop = dropParam === null ? null : z.uuid().safeParse(dropParam);
  if (parsedDrop !== null && !parsedDrop.success) {
    return Response.json({ ok: false, error: "datos" }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
  const dropId = parsedDrop?.success ? parsedDrop.data : null;
  const drop = dropId === null ? null : await dependencies.drops.findDropById(dropId);
  if (dropId !== null && drop === null) {
    return Response.json({ ok: false, error: "datos" }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
  const limit = await dependencies.checkAdminAction(authorization.admin.adminId);
  if (!limit.allowed) {
    return Response.json(
      { ok: false, error: "rate_limited" },
      {
        status: 429,
        headers: { "Cache-Control": "no-store", "Retry-After": String(limit.retryAfterSeconds) },
      },
    );
  }

  const rows = await exportRegistros(authorization.admin.adminId, dropId, dependencies);
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  return new Response("\uFEFF" + createCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="drmr-registros-${drop === null ? "todos" : formatDropNumber(drop.number)}-${date}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
