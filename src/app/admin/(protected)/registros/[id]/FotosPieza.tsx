"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { MAX_PIECE_PHOTOS } from "@/domain/registration/piece-photo";
import { adminHref } from "@/infrastructure/admin/admin-path";

import { BotonArchivo, ENLACE, ETIQUETA } from "../../../ui";
import { prepararImagen } from "../../preparar-imagen";

interface FotosPiezaProps {
  registrationId: string;
  fotoIds: string[];
  habilitado: boolean;
}

interface Vista {
  key: number;
  blob: Blob;
  dataUrl: string;
  error: string | null;
}

const TEXT_ACTION = `${ENLACE} text-[14px]`;
const ETAPA_TEXTO = "Podrás agregar fotos cuando la pieza esté en personalización a mano.";
const NO_SE_PUDO_SUBIR = "No se pudo subir.";

function readAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("No se pudo leer la imagen."));
    reader.readAsDataURL(blob);
  });
}

async function uploadErrorMessage(response: Response): Promise<string> {
  if (response.status === 413) return "La foto pesa más de 1 MB.";
  if (response.status === 415) return "Usa una foto JPG, PNG o WebP.";
  if (response.status === 429) return "Demasiados cambios, espera un momento.";
  if (response.status === 409) {
    const body: { error?: string } = await response.json();
    return body.error === "etapa" ? ETAPA_TEXTO : "Ya hay 6 fotos.";
  }
  return NO_SE_PUDO_SUBIR;
}

export function FotosPieza({ registrationId, fotoIds, habilitado }: FotosPiezaProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const nextKey = useRef(0);
  const [vistas, setVistas] = useState<Vista[]>([]);
  const [confirmando, setConfirmando] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);

  const cupo = MAX_PIECE_PHOTOS - fotoIds.length - vistas.length;
  const urlFotos = adminHref(`/registros/${registrationId}/fotos`);

  async function handleElegir(files: FileList | null) {
    if (files === null || files.length === 0) return;
    setMensaje(null);
    setOcupado(true);
    const elegidas = Array.from(files).slice(0, Math.max(cupo, 0));
    if (files.length > elegidas.length) {
      setMensaje(`Solo caben ${cupo} foto(s) más (máximo ${MAX_PIECE_PHOTOS}).`);
    }
    const nuevas: Vista[] = [];
    try {
      for (const file of elegidas) {
        const blob = await prepararImagen(file);
        nuevas.push({
          key: nextKey.current++,
          blob,
          dataUrl: await readAsDataUrl(blob),
          error: null,
        });
      }
    } catch (error) {
      setMensaje(error instanceof Error ? error.message : NO_SE_PUDO_SUBIR);
    } finally {
      setVistas((actuales) => [...actuales, ...nuevas]);
      if (inputRef.current) inputRef.current.value = "";
      setOcupado(false);
    }
  }

  function quitar(key: number) {
    setVistas((actuales) => actuales.filter((vista) => vista.key !== key));
  }

  function setErrorVista(key: number, error: string) {
    setVistas((actuales) =>
      actuales.map((vista) => (vista.key === key ? { ...vista, error } : vista)),
    );
  }

  async function subir() {
    const pendientes = vistas;
    setMensaje(null);
    setOcupado(true);
    try {
      for (const [indice, vista] of pendientes.entries()) {
        setMensaje(`Subiendo ${indice + 1} de ${pendientes.length}…`);
        try {
          const response = await fetch(urlFotos, {
            method: "POST",
            headers: { "content-type": vista.blob.type },
            body: vista.blob,
          });
          if (response.ok) {
            quitar(vista.key);
          } else {
            setErrorVista(vista.key, await uploadErrorMessage(response));
          }
        } catch {
          setErrorVista(vista.key, NO_SE_PUDO_SUBIR);
        }
      }
    } finally {
      setMensaje(null);
      setOcupado(false);
      router.refresh();
    }
  }

  async function borrar(fotoId: string) {
    setMensaje(null);
    setOcupado(true);
    try {
      const response = await fetch(`${urlFotos}/${fotoId}`, { method: "DELETE" });
      if (!response.ok) {
        setMensaje(
          response.status === 429 ? "Demasiados cambios, espera un momento." : "No se pudo borrar.",
        );
        return;
      }
      setConfirmando(null);
      router.refresh();
    } catch {
      setMensaje("No se pudo borrar.");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <section className="grid gap-3">
      <p className={ETIQUETA}>
        fotos de la pieza · {fotoIds.length}/{MAX_PIECE_PHOTOS}
      </p>

      {fotoIds.length > 0 && (
        <ul className="grid grid-cols-3 gap-2">
          {fotoIds.map((id, indice) => (
            <li key={id} className="grid content-start gap-1">
              <div className="relative aspect-square overflow-hidden bg-papel">
                <Image
                  src={`${urlFotos}/${id}`}
                  alt={`Foto ${indice + 1} de la pieza`}
                  fill
                  unoptimized
                  sizes="100px"
                  className="object-cover"
                />
              </div>
              {confirmando === id ? (
                <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className={ETIQUETA}>¿Borrar?</span>
                  <button
                    type="button"
                    disabled={ocupado}
                    onClick={() => borrar(id)}
                    className={TEXT_ACTION}
                  >
                    Sí
                  </button>
                  <button
                    type="button"
                    disabled={ocupado}
                    onClick={() => setConfirmando(null)}
                    className={TEXT_ACTION}
                  >
                    No
                  </button>
                </p>
              ) : (
                <button
                  type="button"
                  disabled={ocupado}
                  onClick={() => setConfirmando(id)}
                  className={`${TEXT_ACTION} justify-self-start`}
                >
                  Borrar
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {vistas.length > 0 && (
        <>
          <ul className="grid grid-cols-3 gap-2">
            {vistas.map((vista) => (
              <li key={vista.key} className="grid content-start gap-1">
                <div className="relative aspect-square overflow-hidden border border-azul bg-papel">
                  <Image
                    src={vista.dataUrl}
                    alt="Vista previa"
                    fill
                    unoptimized
                    sizes="100px"
                    className="object-cover"
                  />
                </div>
                <button
                  type="button"
                  disabled={ocupado}
                  onClick={() => quitar(vista.key)}
                  className={`${TEXT_ACTION} justify-self-start`}
                >
                  Quitar
                </button>
                {vista.error !== null && <span className={ETIQUETA}>{vista.error}</span>}
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <BotonArchivo disabled={ocupado} onClick={subir}>
              {vistas.length === 1 ? "Subir 1 foto" : `Subir ${vistas.length} fotos`}
            </BotonArchivo>
            <button
              type="button"
              disabled={ocupado}
              onClick={() => setVistas([])}
              className={TEXT_ACTION}
            >
              Cancelar
            </button>
          </div>
        </>
      )}

      {!habilitado && <p className={ETIQUETA}>{ETAPA_TEXTO}</p>}
      {habilitado && cupo > 0 && (
        <label
          className={`${ENLACE} cursor-pointer justify-self-start text-[14px] focus-within:outline focus-within:outline-1 focus-within:outline-offset-4 focus-within:outline-azul`}
        >
          Agregar fotos
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            disabled={ocupado}
            onChange={(event) => handleElegir(event.target.files)}
            className="sr-only"
          />
        </label>
      )}

      <p aria-live="polite" className={ETIQUETA}>
        {mensaje}
      </p>
    </section>
  );
}
