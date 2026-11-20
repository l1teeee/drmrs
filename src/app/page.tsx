import { Suspense } from "react";
import { FondoVideo } from "@/components/FondoVideo";
import { HojaExpediente } from "@/components/HojaExpediente";
import { HojaExpedienteActual } from "@/components/HojaExpedienteActual";
import { Inicio } from "@/components/Inicio";
import { IntroPapel } from "@/components/IntroPapel";
import { TransicionPagina } from "@/components/TransicionPagina";

export default function Home() {
  return (
    <TransicionPagina>
      <FondoVideo variante="azul" />
      <Inicio />
      <IntroPapel
        hoja={
          <Suspense fallback={<HojaExpediente drop={null} />}>
            <HojaExpedienteActual />
          </Suspense>
        }
      />
    </TransicionPagina>
  );
}
