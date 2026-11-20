"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { formatDropNumber, toMexicoLocalInput, type Drop } from "@/domain/drop/drop";
import { BotonArchivo, CAMPO, ENLACE, ETIQUETA } from "../../ui";
import { crearDropAction, editarDropAction } from "./actions";

export function FormularioDrop({ drop, nextNumber, onCancel }: { drop?: Drop; nextNumber: number; onCancel: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  function submit(form: FormData) {
    setError("");
    const fields = { name: form.get("name"), registeredOpensAt: form.get("registeredOpensAt"), publicOpensAt: form.get("publicOpensAt"), pieces: Number(form.get("pieces")) };
    startTransition(async () => {
      const result = drop ? await editarDropAction({ ...fields, dropId: drop.id }) : await crearDropAction({ ...fields, number: Number(form.get("number")) });
      if (result.kind === "created" || result.kind === "updated") { onCancel(); router.refresh(); return; }
      setError(result.kind === "number_taken" ? "Ese número ya existe." : result.kind === "invalid" ? "Revisa los campos." : "No se pudo guardar.");
    });
  }
  return <form onSubmit={(event) => { event.preventDefault(); submit(new FormData(event.currentTarget)); }} className="grid max-w-xl gap-3 py-3">
    <label className={ETIQUETA}>número {drop ? <span className="block text-[15px] text-tinta">{formatDropNumber(drop.number)}</span> : <input className={CAMPO} name="number" type="number" defaultValue={nextNumber} />}</label>
    <label className={ETIQUETA}>nombre<input className={CAMPO} name="name" defaultValue={drop?.name ?? `Archivo ${formatDropNumber(nextNumber)}`} /></label>
    <label className={ETIQUETA}>apertura registrados · hora de México<input className={CAMPO} name="registeredOpensAt" type="datetime-local" defaultValue={drop ? toMexicoLocalInput(drop.registeredOpensAt) : ""} /></label>
    <label className={ETIQUETA}>apertura público · hora de México<input className={CAMPO} name="publicOpensAt" type="datetime-local" defaultValue={drop ? toMexicoLocalInput(drop.publicOpensAt) : ""} /></label>
    <label className={ETIQUETA}>piezas<input className={CAMPO} name="pieces" type="number" defaultValue={drop?.pieces ?? 50} /></label>
    <div className="flex items-center gap-4"><BotonArchivo type="submit" disabled={pending}>{drop ? "Guardar" : "Crear drop"}</BotonArchivo><button type="button" className={ENLACE} onClick={onCancel}>Cancelar</button></div>
    {error && <p role="alert" className={ETIQUETA}>{error}</p>}
  </form>;
}

export function AlternarFormularioDrop({ drop, nextNumber }: { drop?: Drop; nextNumber: number }) {
  const [open, setOpen] = useState(false);
  if (open) return <FormularioDrop drop={drop} nextNumber={nextNumber} onCancel={() => setOpen(false)} />;
  return <button type="button" className={`${ENLACE} text-[13px]`} onClick={() => setOpen(true)}>{drop ? "Editar" : "Nuevo drop"}</button>;
}
