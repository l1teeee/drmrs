import { redirect } from "next/navigation";
import { connection } from "next/server";

import { adminHref } from "@/infrastructure/admin/admin-path";
import { requireAdmin } from "@/infrastructure/auth/require-admin";

export default async function ProtectedHomePage() {
  await connection();
  await requireAdmin("page");
  redirect(adminHref("/registros"));
}
