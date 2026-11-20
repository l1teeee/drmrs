"use client";

import { useEffect, useRef } from "react";

export function HiloMensajes({ count, className, children }: { count: number; className: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [count]);

  return (
    <div ref={ref} role="log" aria-label="Mensajes" tabIndex={0} className={className}>
      {children}
    </div>
  );
}
