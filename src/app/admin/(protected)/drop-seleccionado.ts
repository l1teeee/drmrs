import "server-only";

import { cookies } from "next/headers";
import { listDrops } from "@/application/drops/drops";
import { pickCurrentDrop } from "@/domain/drop/drop";
import { dropsDependencies } from "@/infrastructure/drops/drops-runtime";

export async function selectedDrop(param?: string | string[]) {
  const drops = await listDrops(dropsDependencies());
  const fromParam = typeof param === "string" && (param === "todos" || drops.some((drop) => drop.id === param)) ? param : undefined;
  const value = fromParam ?? (await cookies()).get("drmr_admin_drop")?.value;
  if (value === "todos") return { drops, selected: null, scope: "todos" as const };
  const selected = drops.find((drop) => drop.id === value)
    ?? drops.find((drop) => drop.id === pickCurrentDrop(drops)?.id)
    ?? drops[0]
    ?? null;
  return { drops, selected, scope: "drop" as const };
}
