"use client";

import Link from "next/link";
import { useState } from "react";

import {
  BotonArchivo,
  ENLACE,
  ETIQUETA,
  FILA,
  NUMERO,
  REGLA,
} from "@/app/admin/ui";
import { paginate } from "@/domain/pagination";
import { formatRegistrationNumber } from "@/domain/registration/expediente-link";

export interface ImportarCsvProps {
  previewUrl: string;
  runUrl: string;
  registrosUrl: string;
}

type PreviewRowStatus = "new" | "existing" | "conflict" | "invalid";

interface PreviewRow {
  line: number;
  status: PreviewRowStatus;
  reason?: string;
  registrationNumber?: number | null;
}

interface PreviewData {
  rows: PreviewRow[];
  counts: {
    new: number;
    existing: number;
    conflict: number;
    invalid: number;
  };
}

interface RunSummary {
  created: number;
  existing: number;
  conflicts: number;
  invalid: number;
}

const MAX_BYTES = 1_048_576;
const FILA_GRID =
  "grid grid-cols-[3rem_minmax(0,1fr)_auto] gap-x-4 gap-y-1 sm:grid-cols-[4rem_9rem_5rem_minmax(0,1fr)]";
const CONTEO = `${NUMERO} text-[28px] leading-none md:text-[32px]`;

const STATUS_LABELS: Record<PreviewRowStatus, string> = {
  new: "Nuevo",
  existing: "Ya estaba",
  conflict: "Conflicto",
  invalid: "Error",
};

const STATUS_ORDER: Record<PreviewRowStatus, number> = {
  invalid: 0,
  conflict: 1,
  new: 2,
  existing: 3,
};

async function postCsv(
  url: string,
  csvText: string,
): Promise<{ ok: true; data: unknown } | { ok: false; message: string }> {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "text/csv" },
      body: csvText,
    });

    if (response.status === 200) {
      const data: unknown = await response.json();
      return { ok: true, data };
    }
    if (response.status === 429) {
      return { ok: false, message: "Demasiados intentos, espera unos minutos." };
    }
    if (response.status === 400) {
      const body = (await response.json()) as { error?: unknown };
      const message =
        typeof body.error === "string" && body.error.length > 0
          ? body.error
          : "No se pudo procesar el archivo.";
      return { ok: false, message };
    }
    return { ok: false, message: "No se pudo procesar el archivo." };
  } catch {
    return { ok: false, message: "No se pudo procesar el archivo." };
  }
}

export function ImportarCsv({
  previewUrl,
  runUrl,
  registrosUrl,
}: ImportarCsvProps) {
  const [csvText, setCsvText] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [pagina, setPagina] = useState(1);
  const [runSummary, setRunSummary] = useState<RunSummary | null>(null);
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);

  function handleDragOver(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    if (!sending) {
      setDragging(true);
    }
  }

  function handleDragLeave() {
    setDragging(false);
  }

  async function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    if (sending) {
      return;
    }
    await processFile(event.dataTransfer.files[0]);
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    await processFile(event.target.files?.[0]);
    event.target.value = "";
  }

  async function processFile(file: File | undefined) {
    setError(null);
    setPreview(null);
    setPagina(1);
    setRunSummary(null);
    setCsvText(null);
    setFileName(file ? file.name : null);

    if (!file) {
      return;
    }

    if (file.size > MAX_BYTES) {
      setError("El archivo pasa de 1 MB.");
      return;
    }

    const text = await file.text();
    if (new TextEncoder().encode(text).byteLength > MAX_BYTES) {
      setError("El archivo pasa de 1 MB.");
      return;
    }

    setCsvText(text);
    setSending(true);
    const result = await postCsv(previewUrl, text);
    setSending(false);

    if (!result.ok) {
      setError(result.message);
      return;
    }

    const payload = result.data as PreviewData;
    setPreview(payload);
    setPagina(1);
  }

  async function handleRunImport() {
    if (!csvText || !preview || preview.counts.new === 0) {
      return;
    }
    setError(null);
    setSending(true);
    const result = await postCsv(runUrl, csvText);
    setSending(false);

    if (!result.ok) {
      setError(result.message);
      return;
    }

    const payload = result.data as { summary: RunSummary };
    setRunSummary(payload.summary);
  }

  const orderedRows = preview
    ? [...preview.rows].sort(
        (left, right) =>
          STATUS_ORDER[left.status] - STATUS_ORDER[right.status] ||
          left.line - right.line,
      )
    : [];
  const paginaFilas = paginate(orderedRows, pagina, 25);

  let announcement = "";
  if (runSummary) {
    announcement = `Importados ${runSummary.created}. Ya estaban ${runSummary.existing}. Conflictos ${runSummary.conflicts}. Con error ${runSummary.invalid}.`;
  } else if (preview) {
    announcement = `${preview.counts.new} nuevos, ${preview.counts.existing} ya estaban, ${preview.counts.conflict} en conflicto, ${preview.counts.invalid} con error.`;
  }

  return (
    <div className="grid gap-5">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className="relative"
      >
        <input
          type="file"
          accept=".csv,text/csv"
          aria-label="Archivo CSV del Google Sheet"
          disabled={sending}
          onChange={handleFileChange}
          className="peer absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
        />
        <div
          className={`border px-4 py-[clamp(28px,5vw,56px)] text-center transition-colors duration-300 peer-focus-visible:outline peer-focus-visible:outline-1 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-azul peer-hover:border-tinta peer-disabled:opacity-40 motion-reduce:transition-none ${
            dragging ? "border-azul" : "border-tinta/20"
          }`}
        >
          <p className="text-[15px] text-tinta">
            Suelta el CSV del Google Sheet o{" "}
            <span className="underline underline-offset-4">
              elige un archivo
            </span>
          </p>
        </div>
      </div>

      {fileName && <p className={`${ETIQUETA} break-all`}>{fileName}</p>}

      <p role="status" className={`${ETIQUETA} empty:sr-only`}>
        {sending ? "Procesando…" : ""}
      </p>

      <p role="status" className="sr-only">
        {announcement}
      </p>

      {error && (
        <p role="alert" className="text-[14px]">
          {error}
        </p>
      )}

      {runSummary ? (
        <div className={`grid gap-4 border-t ${REGLA} pt-5`}>
          <p className="text-[17px] font-medium tracking-[-0.01em]">
            {`Importados ${runSummary.created}. Ya estaban ${runSummary.existing}. Conflictos ${runSummary.conflicts}. Con error ${runSummary.invalid}.`}
          </p>
          <div>
            <Link href={registrosUrl} className={ENLACE}>
              Ver registros
            </Link>
          </div>
        </div>
      ) : (
        preview && (
          <div className={`grid gap-5 border-t ${REGLA} pt-5`}>
            <div className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
              <div className="grid gap-1">
                <p className={CONTEO}>{preview.counts.new}</p>
                <p className={ETIQUETA}>nuevos</p>
              </div>
              <div className="grid gap-1">
                <p className={CONTEO}>{preview.counts.existing}</p>
                <p className={ETIQUETA}>ya estaban</p>
              </div>
              <div className="grid gap-1">
                <p className={CONTEO}>{preview.counts.conflict}</p>
                <p className={ETIQUETA}>en conflicto</p>
              </div>
              <div className="grid gap-1">
                <p className={CONTEO}>{preview.counts.invalid}</p>
                <p className={ETIQUETA}>con error</p>
              </div>
            </div>

            <div>
              <BotonArchivo
                disabled={preview.counts.new === 0 || sending}
                onClick={handleRunImport}
              >
                {`Importar ${preview.counts.new} nuevos`}
              </BotonArchivo>
            </div>

            <div>
              <div
                className={`${FILA_GRID} hidden border-b ${REGLA} pb-3 sm:grid`}
              >
                <span className={ETIQUETA}>Línea</span>
                <span className={ETIQUETA}>Estado</span>
                <span className={ETIQUETA}>No.</span>
                <span className={ETIQUETA}>Motivo</span>
              </div>
              <ul>
                {paginaFilas.items.map((row) => (
                  <li
                    key={`${row.line}-${row.status}`}
                    className={`${FILA_GRID} border-b ${FILA} py-3`}
                  >
                    <span className="font-mono text-[13px]">
                      <span className="sm:hidden">L</span>
                      {row.line}
                    </span>
                    <span className="text-[14px]">
                      {STATUS_LABELS[row.status]}
                    </span>
                    <span className="font-mono text-[13px]">
                      {typeof row.registrationNumber === "number"
                        ? formatRegistrationNumber(row.registrationNumber)
                        : "—"}
                    </span>
                    <span className="col-span-2 col-start-2 min-w-0 text-[14px] text-tinta/60 [overflow-wrap:anywhere] sm:col-span-1 sm:col-start-auto">
                      {row.reason ?? "—"}
                    </span>
                  </li>
                ))}
              </ul>
              {paginaFilas.totalPages > 1 && (
                <nav
                  aria-label="Paginación"
                  className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 pt-3"
                >
                  <button
                    type="button"
                    disabled={paginaFilas.page === 1}
                    onClick={() => setPagina(paginaFilas.page - 1)}
                    className={`${ENLACE} text-[13px]`}
                  >
                    ← Anterior
                  </button>
                  <span className={ETIQUETA}>
                    página {paginaFilas.page} de {paginaFilas.totalPages} · {paginaFilas.total}
                  </span>
                  <button
                    type="button"
                    disabled={paginaFilas.page === paginaFilas.totalPages}
                    onClick={() => setPagina(paginaFilas.page + 1)}
                    className={`${ENLACE} text-[13px]`}
                  >
                    Siguiente →
                  </button>
                </nav>
              )}
            </div>
          </div>
        )
      )}
    </div>
  );
}
