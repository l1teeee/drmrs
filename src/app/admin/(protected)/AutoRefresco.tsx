"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

const INTERVALO_MS = 20_000;

export function AutoRefresco() {
  const router = useRouter();

  useEffect(() => {
    function refrescarSiVisible() {
      if (document.visibilityState === "visible") router.refresh();
    }
    const intervalo = window.setInterval(refrescarSiVisible, INTERVALO_MS);
    document.addEventListener("visibilitychange", refrescarSiVisible);
    return () => {
      window.clearInterval(intervalo);
      document.removeEventListener("visibilitychange", refrescarSiVisible);
    };
  }, [router]);

  return null;
}
