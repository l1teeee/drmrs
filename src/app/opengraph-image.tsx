import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ImageResponse } from "next/og";

export const alt = "drmrs archive";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const LOGO_ANCHO = 560;
const LOGO_ALTO = Math.round((LOGO_ANCHO * 72) / 177);

async function logoBlancoDataUri(): Promise<string> {
  const svg = await readFile(join(process.cwd(), "public/drmr-logo.svg"), "utf8");
  const blanco = svg.replaceAll("#182AE1", "#FFFFFF");
  return `data:image/svg+xml;base64,${Buffer.from(blanco).toString("base64")}`;
}

export default async function OpenGraphImage() {
  const logo = await logoBlancoDataUri();

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          height: "100%",
          backgroundColor: "#182AE1",
        }}
      >
        <div
          style={{
            display: "flex",
            width: LOGO_ANCHO,
            height: LOGO_ALTO,
            backgroundImage: `url(${logo})`,
            backgroundSize: "100% 100%",
            backgroundRepeat: "no-repeat",
          }}
        />
      </div>
    ),
    { ...size },
  );
}
