"use client";

import { useSyncExternalStore } from "react";

import { esDispositivoMovil } from "./enlace-chat";

function sinSuscripcion(): () => void {
  return () => {};
}

export function useEsMovil(): boolean {
  return useSyncExternalStore(sinSuscripcion, esDispositivoMovil, () => false);
}
