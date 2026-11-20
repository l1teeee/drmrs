import type { RateLimitCheck } from "@/application/ports/rate-limit";
import type { CreateDropInput, DropStatusInput, UpdateDropInput } from "@/contracts/drops";

import type { CreateDropResult, DropStore } from "./drop-store";

export interface DropsDependencies {
  store: DropStore;
  checkAdminAction: RateLimitCheck;
}

export function listDrops(deps: DropsDependencies) {
  return deps.store.listDrops();
}

export function findDropById(id: string, deps: DropsDependencies) {
  return deps.store.findDropById(id);
}

export async function createDrop(
  adminId: string,
  input: CreateDropInput,
  deps: DropsDependencies,
): Promise<CreateDropResult | { kind: "rate_limited" }> {
  const limit = await deps.checkAdminAction(adminId);
  if (!limit.allowed) return { kind: "rate_limited" };
  return deps.store.createDrop(adminId, input);
}

export async function updateDrop(
  adminId: string,
  input: UpdateDropInput,
  deps: DropsDependencies,
): Promise<{ kind: "updated" | "not_found" | "needs_duration" | "rate_limited" }> {
  const limit = await deps.checkAdminAction(adminId);
  if (!limit.allowed) return { kind: "rate_limited" };
  const { dropId, ...fields } = input;
  return { kind: await deps.store.updateDrop(adminId, dropId, fields) };
}

export async function setDropStatus(
  adminId: string,
  input: DropStatusInput,
  deps: DropsDependencies,
): Promise<{ kind: "updated" | "not_found" | "stale" | "needs_duration" | "rate_limited" }> {
  const limit = await deps.checkAdminAction(adminId);
  if (!limit.allowed) return { kind: "rate_limited" };
  return { kind: await deps.store.setDropStatus(adminId, input.dropId, input.expectedStatus, input.newStatus) };
}
