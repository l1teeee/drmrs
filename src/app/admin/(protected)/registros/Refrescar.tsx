"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { ENLACE } from "../../ui";

export function Refrescar() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      aria-live="polite"
      onClick={() => startTransition(() => router.refresh())}
      className={ENLACE}
    >
      {isPending ? "Refrescando…" : "Refrescar"}
    </button>
  );
}
