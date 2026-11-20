"use client";

import { useState } from "react";

type Feedback = "copied" | "failed" | null;

const LINK_CLASSES =
  "group relative inline-flex items-center justify-center overflow-hidden border border-azul px-6 py-4 text-[16px] font-medium text-azul transition-colors duration-300 hover:text-white focus-visible:text-white focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-4 focus-visible:outline-azul motion-reduce:transition-none";
const SWEEP_CLASSES =
  "absolute inset-0 origin-left scale-x-0 bg-azul transition-transform duration-300 ease-out group-hover:scale-x-100 group-focus-visible:scale-x-100 motion-reduce:transition-none";

export function EnviarPorInstagram({ username, text }: { username: string; text: string }) {
  const [feedback, setFeedback] = useState<Feedback>(null);

  const cleanUsername = username.replace(/^@/, "");

  async function handleClick() {
    let result: Feedback = "copied";
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      result = "failed";
    }
    setFeedback(result);
    setTimeout(() => {
      setFeedback(null);
    }, 2000);
  }

  const label =
    feedback === "copied"
      ? "Copiado"
      : feedback === "failed"
        ? "No se pudo copiar"
        : "Enviar por Instagram";

  return (
    <a
      href={`https://ig.me/m/${encodeURIComponent(cleanUsername)}`}
      target="_blank"
      rel="noopener noreferrer"
      onClick={handleClick}
      aria-live="polite"
      className={LINK_CLASSES}
    >
      <span aria-hidden="true" className={SWEEP_CLASSES} />
      <span className="relative">{label}</span>
    </a>
  );
}
