"use client";

import { useEffect, useRef, useState } from "react";

type AccionesExpedienteProps = {
  slug: string;
  registrationNumber: string;
  folio: string;
  archivo: string;
};

export function AccionesExpediente({
  slug,
  registrationNumber,
  folio,
  archivo,
}: AccionesExpedienteProps) {
  const [copiado, setCopiado] = useState(false);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (temporizador.current) {
        clearTimeout(temporizador.current);
      }
    };
  }, []);

  async function compartir() {
    const url = window.location.href;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({
          title: `Expediente ${registrationNumber} · ${archivo} · drmrs archive`,
          url,
        });
      } catch {
        // User cancellation of the share sheet is not an error.
      }
      return;
    }

    await navigator.clipboard.writeText(url);
    setCopiado(true);
    if (temporizador.current) {
      clearTimeout(temporizador.current);
    }
    temporizador.current = setTimeout(() => {
      setCopiado(false);
    }, 2000);
  }

  return (
    <div className="mt-10 flex flex-wrap items-center gap-6">
      <button
        type="button"
        onClick={compartir}
        className="font-mono text-[13px] text-tinta underline-offset-4 hover:underline"
      >
        {copiado ? "Link copiado" : "Compartir"}
      </button>
      <a
        href={`/expediente/${slug}/historia`}
        download={`expediente-${folio}-${registrationNumber}.png`}
        className="font-mono text-[13px] text-tinta underline-offset-4 hover:underline"
      >
        Guardar para historia
      </a>
    </div>
  );
}
