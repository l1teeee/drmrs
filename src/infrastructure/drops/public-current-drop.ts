import { cacheLife, cacheTag } from "next/cache";

import { pickCurrentDrop, type Drop } from "@/domain/drop/drop";

import { postgresDropRepository } from "../db/repositories/postgres-drop-repository";

// Callers must call `await connection()` before this so it never runs at build time.
export async function getPublicCurrentDrop(): Promise<Drop | null> {
  "use cache";
  cacheLife("minutes");
  cacheTag("drops");

  return pickCurrentDrop(await postgresDropRepository.listDrops());
}
