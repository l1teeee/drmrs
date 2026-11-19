import { ImageResponse } from "next/og";

import { cargarFuenteMaquina } from "@/app/expediente/expediente-imagen";

export const alt = "drmrs archive · Archivo 001";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpenGraphImage() {
  const fuente = await cargarFuenteMaquina();
  const margen = Math.round(size.width * 0.08);

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          width: "100%",
          height: "100%",
          padding: `${margen}px`,
          backgroundColor: "#182AE1",
          color: "#ffffff",
          fontFamily: '"Courier Prime", monospace',
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: "76px",
            lineHeight: 1.1,
          }}
        >
          drmrs archive
        </div>
        <div
          style={{
            display: "flex",
            width: "100%",
            height: "1px",
            backgroundColor: "rgba(255, 255, 255, 0.3)",
            marginTop: "36px",
            marginBottom: "36px",
          }}
        />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            fontSize: "30px",
            lineHeight: 1.6,
          }}
        >
          <div style={{ display: "flex" }}>Archivo 001 · 50 piezas numeradas</div>
          <div style={{ display: "flex" }}>04.12 · 19:00 · Querétaro</div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        {
          name: "Courier Prime",
          data: fuente,
          style: "normal",
          weight: 400,
        },
      ],
    },
  );
}
