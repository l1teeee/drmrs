import { FondoVideo } from "@/components/FondoVideo";
import { Inicio } from "@/components/Inicio";
import { IntroPapel } from "@/components/IntroPapel";
import { TransicionPagina } from "@/components/TransicionPagina";

export default function Home() {
  return (
    <TransicionPagina>
      <FondoVideo variante="azul" />
      <Inicio />
      <IntroPapel />
    </TransicionPagina>
  );
}
