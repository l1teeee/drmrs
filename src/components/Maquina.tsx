// Typewriter helpers shared by the intro sheet and the registration page.
export const TINTA_MAQUINA = "[text-shadow:0_0_0.6px_rgba(31,31,34,0.45)]";

export function Subrayado({ children }: { children: string }) {
  return (
    <span className="relative">
      {children}
      {/* Typewriter underline: underscores typed over the same characters. */}
      <span aria-hidden="true" className="absolute left-0 top-0">
        {"_".repeat(children.length)}
      </span>
    </span>
  );
}
