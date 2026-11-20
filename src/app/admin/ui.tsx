import type { ButtonHTMLAttributes } from "react";

export const ETIQUETA = "font-mono text-[11px] text-tinta/60";
export const CAMPO =
  "w-full border-b border-tinta/20 bg-transparent py-1.5 text-[16px] text-tinta outline-none placeholder:text-tinta/35 focus:border-tinta md:text-[15px]";
export const CAMPO_AREA =
  "w-full border border-tinta/20 bg-transparent p-2.5 text-[16px] text-tinta outline-none placeholder:text-tinta/35 focus:border-tinta md:text-[14px]";
export const TITULO = "text-[22px] font-medium tracking-[-0.02em] md:text-[26px]";
export const NUMERO = "font-extralight tabular-nums tracking-[-0.04em]";
export const ENLACE =
  "underline underline-offset-4 transition-colors duration-300 hover:text-azul focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-4 focus-visible:outline-azul disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none";
export const REGLA = "border-tinta/20";
export const FILA = "border-tinta/10";

const BOTON_BASE =
  "group relative inline-flex items-center justify-center overflow-hidden border px-4 py-2 text-[14px] font-medium transition-colors duration-300 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none";
const BARRIDO_BASE =
  "absolute inset-0 origin-left scale-x-0 transition-transform duration-300 ease-out group-enabled:group-hover:scale-x-100 group-enabled:group-focus-visible:scale-x-100 motion-reduce:transition-none";

export function BotonArchivo({
  children,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      {...props}
      className={`${BOTON_BASE} border-azul text-azul enabled:hover:text-white enabled:focus-visible:text-white`}
    >
      <span aria-hidden="true" className={`${BARRIDO_BASE} bg-azul`} />
      <span className="relative">{children}</span>
    </button>
  );
}

export function BotonArchivoTinta({
  children,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      {...props}
      className={`${BOTON_BASE} border-tinta text-tinta enabled:hover:text-papel enabled:focus-visible:text-papel`}
    >
      <span aria-hidden="true" className={`${BARRIDO_BASE} bg-tinta`} />
      <span className="relative">{children}</span>
    </button>
  );
}
