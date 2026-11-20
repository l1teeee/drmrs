"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { linkContactManuallyAction } from "../../mensajes/actions";
import { BotonArchivo, CAMPO, ETIQUETA } from "../../../ui";

export interface ContactoVinculable {
  id: string;
  username: string | null;
  displayName: string | null;
  lastInboundAt: string;
  linkedTags: string[];
}

const SELECT = `${CAMPO} max-w-md disabled:cursor-not-allowed disabled:opacity-40`;

const dateFormatter = new Intl.DateTimeFormat("es-MX", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Mexico_City",
});

function errorMessage(error: string): string {
  if (error === "conflict") return "Ese contacto ya tiene un registro en este drop.";
  if (error === "invalid_state") return "Este registro ya está vinculado.";
  return "No se pudo vincular.";
}

export function VincularContacto({
  registrationId,
  contacts,
}: {
  registrationId: string;
  contacts: ContactoVinculable[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [contactId, setContactId] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleLink() {
    setError(null);
    startTransition(async () => {
      const result = await linkContactManuallyAction({ registrationId, contactId });
      if (!result.ok) {
        setError(errorMessage(result.error));
        return;
      }
      // This section unmounts after the refresh, so move focus to the page title first.
      document.querySelector("h1")?.focus();
      router.refresh();
    });
  }

  return (
    <section className="grid gap-3">
      <h2 className={ETIQUETA}>Vincular a mano</h2>
      <select
        aria-label="Contacto"
        value={contactId}
        disabled={isPending}
        onChange={(event) => setContactId(event.target.value)}
        className={SELECT}
      >
        <option value="" className="bg-papel text-tinta">
          Elige un contacto
        </option>
        {contacts.map((contact) => (
          <option key={contact.id} value={contact.id} className="bg-papel text-tinta">
            {contact.username ? `@${contact.username}` : (contact.displayName ?? "sin usuario")}
            {" · "}
            {dateFormatter.format(new Date(contact.lastInboundAt))}
            {contact.linkedTags.length > 0 && ` · ya en ${contact.linkedTags.join(", ")}`}
          </option>
        ))}
      </select>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <BotonArchivo disabled={isPending || contactId === ""} onClick={handleLink}>
          Vincular
        </BotonArchivo>
        <p aria-live="polite" className={ETIQUETA}>
          {error}
        </p>
      </div>
    </section>
  );
}
