import { readFile } from "node:fs/promises";
import { join } from "node:path";

type ExpedienteImagenProps = {
  ancho: number;
  alto: number;
  registro: string;
  nombre: string;
  talla: string;
  estado: string;
};

export async function cargarFuenteMaquina(): Promise<ArrayBuffer> {
  const buffer = await readFile(join(process.cwd(), "src/app/fonts/CourierPrime-Regular.ttf"));
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
}

export function ExpedienteImagen({
  ancho,
  alto,
  registro,
  nombre,
  talla,
  estado,
}: ExpedienteImagenProps) {
  const margen = Math.round(ancho * 0.08);
  const tamanoRegistro = Math.round(alto * 0.12);
  const tamanoBase = Math.max(22, Math.round(ancho * 0.024));

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        width: "100%",
        height: "100%",
        padding: `${margen}px`,
        backgroundColor: "#ededed",
        color: "#1f1f22",
        fontFamily: '"Courier Prime", monospace',
        fontSize: `${tamanoBase}px`,
        lineHeight: 1.65,
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ display: "flex" }}>drmrs archive — exp. 001</div>
        <div
          style={{
            display: "flex",
            fontSize: `${tamanoRegistro}px`,
            lineHeight: 1.05,
            marginTop: `${Math.round(alto * 0.04)}px`,
            marginBottom: `${Math.round(alto * 0.04)}px`,
          }}
        >
          {`registro ${registro}`}
        </div>
        <div style={{ display: "flex" }}>{`nombre: ${nombre}`}</div>
        <div style={{ display: "flex" }}>{`talla: ${talla}`}</div>
        <div style={{ display: "flex" }}>{`pieza: ${estado}`}</div>
        <div style={{ display: "flex" }}>apertura: 04.12.26, 19:00 h</div>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          width: "100%",
        }}
      >
        {`folio ${registro}`}
      </div>
    </div>
  );
}
