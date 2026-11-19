import { ViewTransition } from "react";
import type { ReactNode } from "react";

// Wraps a whole page so client-side navigations crossfade between sections (styles in globals.css).
export function TransicionPagina({ children }: { children: ReactNode }) {
  return (
    <ViewTransition enter="pagina-entra" exit="pagina-sale" default="none">
      {children}
    </ViewTransition>
  );
}
