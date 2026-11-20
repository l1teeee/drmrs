"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

export function ContenidoAdmin({ className, children }: { className: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const query = useSearchParams().toString();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.scrollTo({ top: 0 });
  }, [pathname, query]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
