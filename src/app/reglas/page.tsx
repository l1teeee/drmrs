import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { PaginaLegal } from "@/components/legal/PaginaLegal";
import styles from "@/components/legal/legal.module.css";
import {
  formatDropDateLabel,
  formatDropDateShort,
  formatDropNumber,
} from "@/domain/drop/drop";
import { getPublicCurrentDrop } from "@/infrastructure/drops/public-current-drop";
import { log, safeErrorCode } from "@/infrastructure/observability/logger";

export const metadata: Metadata = {
  title: "Reglas del registro",
};

async function ContenidoReglas() {
  await connection();
  let drop = null;
  let falloCarga = false;
  try {
    drop = await getPublicCurrentDrop();
  } catch (error) {
    falloCarga = true;
    log("error", "public_drop_failed", { code: safeErrorCode(error) });
  }

  const datosDrop = drop
    ? (() => {
        const aperturaLabel = formatDropDateLabel(drop.registeredOpensAt);
        const publicoLabel = formatDropDateLabel(drop.publicOpensAt);
        return {
          nombre: drop.name,
          piezas: drop.pieces,
          piezasFin: formatDropNumber(drop.pieces),
          aperturaCorta: formatDropDateShort(drop.registeredOpensAt),
          aperturaLabel,
          publicoLabel,
          ventana24h: `${aperturaLabel} → ${publicoLabel}`,
        };
      })()
    : null;

  return (
    <>
      {datosDrop ? (
        <p>
          El {datosDrop.aperturaCorta} se abre el {datosDrop.nombre}. Máximo {datosDrop.piezas}{" "}
          piezas numeradas, de la 001 a la {datosDrop.piezasFin}. Este diseño no se vuelve a hacer.
        </p>
      ) : falloCarga ? (
        <p>No pudimos cargar los datos del archivo.</p>
      ) : (
        <p>El registro está cerrado.</p>
      )}

      <h2>Lo que gana todo el registro</h2>
      <ul>
        {datosDrop && (
          <li>
            Entras 24 horas antes que el público: el {datosDrop.aperturaLabel} te escribimos por
            WhatsApp con tu acceso. El público entra el {datosDrop.publicoLabel}.
          </li>
        )}
        <li>
          Tu número de registro es tuyo. Si te registras dos veces con el mismo WhatsApp, te quedas
          con el primero.
        </li>
      </ul>

      <h2>Los primeros diez</h2>
      <ul>
        <li>
          Los registros <b>0001 al 0010</b> se llevan la pieza con su mismo número: el 0007 se
          lleva la pieza 007.
        </li>
        <li>
          Ese número se te guarda solo durante las 24 horas de acceso anticipado
          {datosDrop ? ` (${datosDrop.ventana24h})` : ""}. Si no la apartas en ese tiempo, la pieza
          se libera.
        </li>
        <li>
          <b>El 0001 se lleva la pieza 001 gratis</b>, con envío incluido. Solo tiene que
          confirmarnos su talla y sus datos de entrega dentro de esas mismas 24 horas. Si no lo
          hace, la pieza 001 se libera y el premio no pasa a nadie más.
        </li>
      </ul>

      <h2>Quién cuenta</h2>
      <ul>
        <li>
          Cuentan las personas que se registran en drmr.com.mx con su propio nombre y WhatsApp.
        </li>
        <li>
          Los socios de drmr, sus familias y los registros de prueba no cuentan. El contador empezó
          de cero cuando se publicaron estas reglas: el 0001 es la primera persona real.
        </li>
        <li>
          Un registro por número de WhatsApp. Los registros falsos, repetidos o hechos con bots se
          anulan, y el número pasa al siguiente registro válido.
        </li>
      </ul>

      <h2>La preventa</h2>
      <ul>
        <li>
          Antes de cobrar publicamos el precio, las tallas, el costo de envío y la fecha de
          entrega, junto con la pieza.
        </li>
        <li>
          Hacemos solo las piezas que se aparten. Si al cierre no se llega al mínimo de piezas que
          publiquemos con el precio, no se hace: te devolvemos el 100% a la misma tarjeta o cuenta
          con la que pagaste. En ese caso la pieza 001 gratis tampoco se hace.
        </li>
        <li>
          Si tu pieza no sale a más tardar el viernes 29 de enero de 2027, te devolvemos el 100%.
        </li>
        <li>
          Si la fecha de la preventa cambia, tu número de registro y lo que gana se mantienen: las
          24 horas de acceso anticipado se mueven con ella y te avisamos por WhatsApp.
        </li>
      </ul>

      <h2>Esto no es un sorteo</h2>
      <p>
        No hay suerte de por medio: gana el orden de llegada. Tu número sale en pantalla en cuanto
        te registras.
      </p>

      <h2>Dudas</h2>
      <p>
        Escríbenos a <a href="mailto:drmrstudiosmx@gmail.com">drmrstudiosmx@gmail.com</a> o por
        Instagram a @drmrs.archive. Tus datos se usan como dice el{" "}
        <Link href="/aviso-de-privacidad">aviso de privacidad</Link>.
      </p>

      <p className={styles.nota}>
        El precio, las tallas, el envío y la fecha de entrega se publican junto con la pieza, antes
        de que abra la preventa.
      </p>
    </>
  );
}

export default function ReglasPage() {
  return (
    <PaginaLegal titulo="Reglas del registro" actualizacion="18 noviembre 2026">
      <Suspense fallback={<div aria-hidden="true" className="min-h-[60vh]" />}>
        <ContenidoReglas />
      </Suspense>
    </PaginaLegal>
  );
}
