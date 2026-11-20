import type { CreateDropInput } from "@/contracts/drops";
import type { Drop, DropStatus } from "@/domain/drop/drop";

export type DropWithCount = Drop & { registrations: number };
export type CreateDropResult = { kind: "created"; id: string } | { kind: "number_taken" };
export type SetDropStatusResult = "updated" | "not_found" | "stale" | "needs_duration";

export interface DropStore {
  listDrops(): Promise<DropWithCount[]>;
  findDropById(id: string): Promise<Drop | null>;
  findOpenDrop(): Promise<Drop | null>;
  createDrop(adminId: string, input: CreateDropInput): Promise<CreateDropResult>;
  updateDrop(adminId: string, id: string, input: Omit<CreateDropInput, "number">): Promise<"updated" | "not_found" | "needs_duration">;
  setDropStatus(adminId: string, id: string, expected: DropStatus, next: DropStatus): Promise<SetDropStatusResult>;
}
