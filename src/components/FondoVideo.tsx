"use client";

import { useEffect, useRef } from "react";

const PANTALLA_VERTICAL = "(max-aspect-ratio: 4/5)";

type Variante = "azul" | "blanco-negro";

export function FondoVideo({ variante }: { variante: Variante }) {
  const video = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const elemento = video.current;
    if (!elemento) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const vertical = window.matchMedia(PANTALLA_VERTICAL).matches;
    elemento.poster = vertical ? "/poster-vertical.jpg" : "/poster-horizontal.jpg";
    elemento.src = vertical ? "/video-vertical.mp4" : "/video-horizontal.mp4";
  }, []);

  const elementoVideo = (
    <video
      ref={video}
      autoPlay
      muted
      loop
      playsInline
      preload="none"
      poster="/poster-horizontal.jpg"
      className={
        variante === "blanco-negro"
          ? "block size-full object-cover grayscale contrast-125"
          : "block size-full object-cover"
      }
    />
  );

  if (variante === "blanco-negro") {
    return (
      <div aria-hidden="true" className="fixed inset-0 -z-10">
        {elementoVideo}
        {/* Darkens the footage so the white sketch and type stay readable. */}
        <div className="absolute inset-0 bg-black/45" />
      </div>
    );
  }

  return (
    <div aria-hidden="true" className="fixed inset-0 -z-10 bg-noche">
      {elementoVideo}
      <div className="velo-azul absolute inset-0" />
    </div>
  );
}
