"use client";

import { useActionState } from "react";

import { BotonArchivoTinta } from "../ui";
import { loginAction } from "./actions";

const ETIQUETA = "font-mono text-[12px] text-tinta/60";
const CAMPO_PAPEL =
  "w-full border-b border-tinta/30 bg-transparent py-2 text-[17px] text-tinta outline-none focus:border-tinta focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-tinta";

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, { error: "" });

  return (
    <form action={action} className="grid gap-6">
      <label className="grid gap-1">
        <span className={ETIQUETA}>correo</span>
        <input
          name="email"
          type="email"
          autoComplete="email"
          required
          maxLength={254}
          className={CAMPO_PAPEL}
        />
      </label>
      <label className="grid gap-1">
        <span className={ETIQUETA}>clave</span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          maxLength={256}
          className={CAMPO_PAPEL}
        />
      </label>
      <div className="mt-4 grid">
        <BotonArchivoTinta type="submit" disabled={pending}>
          {pending ? "entrando…" : "Entrar"}
        </BotonArchivoTinta>
      </div>
      <div aria-live="polite" className="text-center font-sans text-[14px] text-tinta">
        {state.error && <p>{state.error}</p>}
      </div>
    </form>
  );
}
