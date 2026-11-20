"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

export function ContenidoAdmin({ className, children }: { className: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.scrollTo({ top: 0 });
  }, [pathname]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
