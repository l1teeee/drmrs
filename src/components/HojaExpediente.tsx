import { Subrayado, TINTA_MAQUINA } from "@/components/Maquina";
import { formatDropNumber } from "@/domain/drop/drop";
import type { DropPublico } from "@/lib/drop-publico";

type HojaExpedienteProps = {
  drop: DropPublico | null;
};

export function HojaExpediente({ drop }: HojaExpedienteProps) {
  const tieneDrop = drop !== null && drop.estado !== "SIN_DROP";
  const folio = tieneDrop ? drop.folio : "___";
  const nombre = tieneDrop && drop.nombre ? drop.nombre.toLowerCase() : "___";
  const piezasTexto =
    tieneDrop && drop.piezas !== null ? `${drop.piezas} piezas numeradas` : "___ piezas numeradas";
  const piezasFolio = tieneDrop && drop.piezas !== null ? formatDropNumber(drop.piezas) : "___";
  const [fechaApertura, horaApertura] =
    tieneDrop && drop.aperturaSello ? drop.aperturaSello.split(", ") : [];

  return (
    <div className="absolute inset-0 font-mono text-[11px] leading-[1.6] text-tinta md:text-[13px]">
      <div
        className={`absolute left-[clamp(20px,6vw,96px)] top-[clamp(24px,7vh,72px)] rotate-[-0.4deg] ${TINTA_MAQUINA}`}
      >
        <p className="opacity-90">drmrs archive — exp. {folio}</p>
        <p className="opacity-80">
          material: {nombre}, <Subrayado>{piezasTexto}</Subrayado>
        </p>
        <p className="translate-x-px opacity-85">lugar: querétaro, mx</p>
        <p className="opacity-75">
          apertura: <Subrayado>{fechaApertura || "___"}</Subrayado>
          {horaApertura ? `, ${horaApertura}` : ""}
        </p>
      </div>

      <p
        className={`absolute bottom-[clamp(24px,7vh,72px)] right-[clamp(20px,6vw,96px)] rotate-[0.3deg] opacity-75 ${TINTA_MAQUINA}`}
      >
        folio 001/{piezasFolio}
      </p>
    </div>
  );
}
