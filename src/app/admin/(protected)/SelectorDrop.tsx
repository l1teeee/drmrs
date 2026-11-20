"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { seleccionarDropAction } from "./actions";

export function SelectorDrop({ drops, value }: { drops: { id: string; label: string }[]; value?: string }) {
  const router = useRouter();
  const param = useSearchParams().get("drop");
  const shown = param === "todos" || drops.some((d) => d.id === param) ? param : value;
  const [pending, startTransition] = useTransition();
  return (
    <select aria-label="Archivo" value={shown ?? ""} disabled={pending}
      className="border-b border-tinta/20 bg-transparent py-1 font-mono text-[12px]"
      onChange={(event) => {
        const next = event.target.value;
        startTransition(async () => {
          const result = await seleccionarDropAction(next);
          if (result.ok) {
            const url = new URL(window.location.href);
            if (url.searchParams.has("drop")) {
              url.searchParams.set("drop", next);
              router.replace(`${url.pathname}${url.search}${url.hash}`);
            }
            router.refresh();
          }
        });
      }}>
      {!shown && <option value="" disabled>Elige un archivo</option>}
      {drops.map((drop) => <option key={drop.id} value={drop.id}>{drop.label}</option>)}
      <option value="todos">Todos los archivos</option>
    </select>
  );
}
