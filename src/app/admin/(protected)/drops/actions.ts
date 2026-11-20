"use server";

import { revalidatePath, updateTag } from "next/cache";
import { createDrop, setDropStatus, updateDrop } from "@/application/drops/drops";
import { createDropSchema, dropStatusSchema, updateDropSchema } from "@/contracts/drops";
import { requireAdmin } from "@/infrastructure/auth/require-admin";
import { dropsDependencies } from "@/infrastructure/drops/drops-runtime";

export async function crearDropAction(input: unknown) {
  const auth = await requireAdmin("action");
  if (!auth.ok) return { kind: "error" as const };
  const parsed = createDropSchema.safeParse(input);
  if (!parsed.success) return { kind: "invalid" as const };
  const result = await createDrop(auth.admin.adminId, parsed.data, dropsDependencies());
  if (result.kind === "created") { updateTag("drops"); revalidatePath("/admin", "layout"); }
  return result;
}

export async function editarDropAction(input: unknown) {
  const auth = await requireAdmin("action");
  if (!auth.ok) return { kind: "error" as const };
  const parsed = updateDropSchema.safeParse(input);
  if (!parsed.success) return { kind: "invalid" as const };
  const result = await updateDrop(auth.admin.adminId, parsed.data, dropsDependencies());
  if (result.kind === "updated") { updateTag("drops"); revalidatePath("/admin", "layout"); }
  return result;
}

export async function cambiarEstadoDropAction(input: unknown) {
  const auth = await requireAdmin("action");
  if (!auth.ok) return { kind: "error" as const };
  const parsed = dropStatusSchema.safeParse(input);
  if (!parsed.success) return { kind: "invalid" as const };
  const result = await setDropStatus(auth.admin.adminId, parsed.data, dropsDependencies());
  if (result.kind === "updated") { updateTag("drops"); revalidatePath("/admin", "layout"); }
  return result;
}
