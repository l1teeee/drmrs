import { Subrayado, TINTA_MAQUINA } from "@/components/Maquina";

export function HojaExpediente() {
  return (
    <div className="absolute inset-0 font-mono text-[11px] leading-[1.6] text-tinta md:text-[13px]">
      <div
        className={`absolute left-[clamp(20px,6vw,96px)] top-[clamp(24px,7vh,72px)] rotate-[-0.4deg] ${TINTA_MAQUINA}`}
      >
        <p className="opacity-90">drmrs archive — exp. 001</p>
        <p className="opacity-80">
          material: archivo 001, <Subrayado>50 piezas numeradas</Subrayado>
        </p>
        <p className="translate-x-px opacity-85">lugar: querétaro, mx</p>
        <p className="opacity-75">
          apertura: <Subrayado>04.12.26</Subrayado>, 19:00 h
        </p>
      </div>

      <p
        className={`absolute bottom-[clamp(24px,7vh,72px)] right-[clamp(20px,6vw,96px)] rotate-[0.3deg] opacity-75 ${TINTA_MAQUINA}`}
      >
        folio 001/050
      </p>
    </div>
  );
}
