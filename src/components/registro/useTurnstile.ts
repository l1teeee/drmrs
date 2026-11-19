"use client";

import { type RefObject, useCallback, useEffect, useRef } from "react";

type TurnstileOptions = {
  sitekey: string;
  action: "registro";
  appearance: "always";
  theme: "dark";
  size: "flexible";
  language: "es";
  callback: (token: string) => void;
  "expired-callback": () => void;
  "error-callback": () => void;
};

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement | string,
        options: TurnstileOptions,
      ) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
    };
    onTurnstile?: () => void;
  }
}

export function useTurnstile(
  sitekey: string,
  contenedor: RefObject<HTMLDivElement | null>,
): {
  obtenerToken: () => string;
  esperarToken: (ms: number) => Promise<string>;
  reiniciar: () => void;
} {
  const tokenRef = useRef("");
  const widgetRef = useRef<string | null>(null);

  useEffect(() => {
    if (!sitekey) return;

    window.onTurnstile = () => {
      if (!contenedor.current || !window.turnstile) return;
      widgetRef.current = window.turnstile.render(contenedor.current, {
        sitekey,
        action: "registro",
        appearance: "always",
        theme: "dark",
        size: "flexible",
        language: "es",
        callback: (t: string) => {
          tokenRef.current = t;
        },
        "expired-callback": () => {
          tokenRef.current = "";
        },
        "error-callback": () => {
          tokenRef.current = "";
        },
      });
    };

    if (window.turnstile) {
      window.onTurnstile();
    } else if (
      !document.querySelector(
        'script[src^="https://challenges.cloudflare.com/turnstile/"]',
      )
    ) {
      const sc = document.createElement("script");
      sc.src =
        "https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onTurnstile&render=explicit";
      sc.async = true;
      document.head.appendChild(sc);
    }
    return () => {
      if (widgetRef.current !== null && window.turnstile) {
        window.turnstile.remove(widgetRef.current);
        widgetRef.current = null;
      }
      tokenRef.current = "";
    };
  }, [sitekey, contenedor]);

  const obtenerToken = useCallback(() => tokenRef.current, []);

  const esperarToken = useCallback(
    (ms: number) => {
      return new Promise<string>((ok) => {
        const t0 = Date.now();
        function mira() {
          if (tokenRef.current || !sitekey || Date.now() - t0 > ms) {
            return ok(tokenRef.current);
          }
          setTimeout(mira, 250);
        }
        mira();
      });
    },
    [sitekey],
  );

  const reiniciar = useCallback(() => {
    tokenRef.current = "";
    if (widgetRef.current !== null && window.turnstile) {
      window.turnstile.reset(widgetRef.current);
    }
  }, []);

  return { obtenerToken, esperarToken, reiniciar };
}
