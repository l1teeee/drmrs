import { connection } from "next/server";
import { listDrops } from "@/application/drops/drops";
import { DROP_STATUS_LABELS, durationFromHours, formatDropDateLabel, formatDropNumber, isRegistrationOpen, pickCurrentDrop, registrationClosesAt } from "@/domain/drop/drop";
import { requireAdmin } from "@/infrastructure/auth/require-admin";
import { dropsDependencies } from "@/infrastructure/drops/drops-runtime";
import { ETIQUETA, FILA, NUMERO, TITULO } from "../../ui";
import { EstadoDrop } from "./EstadoDrop";
import { AlternarFormularioDrop } from "./FormularioDrop";

export default async function DropsPage() {
  await connection();
  await requireAdmin("page");
  const drops = await listDrops(dropsDependencies());
  const current = pickCurrentDrop(drops);
  const now = new Date();
  const open = drops.find((drop) => isRegistrationOpen(drop, now));
  const nextNumber = (drops[0]?.number ?? 0) + 1;
  return <main className="grid gap-4">
    <h1 className={TITULO}>Drops</h1>
    <ul className={`border-t ${FILA}`}>
      {drops.map((drop) => {
        const duration = drop.registrationHours === null ? null : durationFromHours(drop.registrationHours);
        const end = drop.status === "REGISTRO" ? registrationClosesAt(drop) : null;
        return <li key={drop.id} className={`grid gap-2 border-b ${FILA} py-4`}>
        <div className="flex items-baseline gap-4"><span className={`${NUMERO} text-[20px] md:text-[22px]`}>{formatDropNumber(drop.number)}</span><span className="text-[15px] font-medium">{drop.name}</span></div>
        <div className={`flex flex-wrap gap-x-4 gap-y-1 ${ETIQUETA}`}><span>registrados {drop.registrations}</span><span>apertura registrados {formatDropDateLabel(drop.registeredOpensAt)}</span><span>público {formatDropDateLabel(drop.publicOpensAt)}</span><span>piezas {drop.pieces}</span><span className={current?.id === drop.id ? "text-azul" : ""}>{DROP_STATUS_LABELS[drop.status]}</span></div>
        <div className={`flex flex-wrap gap-x-4 gap-y-1 ${ETIQUETA}`}><span>pre-registro: {duration ? `${duration.amount} ${duration.unit === "dias" ? "días" : "horas"}` : "sin duración"}</span>{end && <span>{now < end ? "abierto hasta" : "terminó"} {formatDropDateLabel(end)}</span>}</div>
        <div className="flex flex-wrap items-baseline gap-4"><AlternarFormularioDrop drop={drop} nextNumber={nextNumber} /><EstadoDrop id={drop.id} status={drop.status} otro={open?.id !== drop.id ? open?.name : undefined} /></div>
      </li>; })}
    </ul>
    <div><AlternarFormularioDrop nextNumber={nextNumber} /></div>
  </main>;
}
