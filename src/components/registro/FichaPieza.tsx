import { Subrayado } from "@/components/Maquina";
import { CarruselPrenda } from "@/components/registro/CarruselPrenda";

export function FichaPieza() {
  return (
    <aside
      aria-label="La pieza"
      className="flex min-h-[80svh] flex-col gap-6 p-[clamp(20px,3vw,40px)] font-mono text-[12px] leading-[1.7] md:min-h-0 md:border-l md:border-white/15 md:text-[13px]"
    >
      <div className="rotate-[-0.4deg]">
        <p className="opacity-90">archivo 001 — ficha de pieza</p>
        <p className="opacity-80">prenda: crewneck</p>
        <p className="translate-x-px opacity-85">tela: felpa 100% algodón, deslavada</p>
        <p className="opacity-80">
          piezas: <Subrayado>de la 001 a la 050</Subrayado>
        </p>
        <p className="opacity-85">diseño: querétaro</p>
        <p className="opacity-75">gráfico: se revela antes del 04.12</p>
      </div>
      <CarruselPrenda />
    </aside>
  );
}
