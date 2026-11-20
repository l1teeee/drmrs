"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { ConfirmacionRegistro } from "@/components/registro/ConfirmacionRegistro";
import { useTurnstile } from "@/components/registro/useTurnstile";
import { TURNSTILE_SITEKEY } from "@/lib/registro/config";
import { enlacePlanB } from "@/lib/registro/enlaces";
import {
  type DatosRegistro,
  enviarRegistro,
  type RespuestaRegistro,
} from "@/lib/registro/enviar-registro";
import { normalizarInstagram } from "@/lib/registro/instagram";
import { detectarOrigen } from "@/lib/registro/origen";
import { limpiarEntradaTelefono, normalizarTelefono } from "@/lib/registro/telefono";
import { type ErrorRegistro, validarRegistro } from "@/lib/registro/validacion";

const TALLAS = [
  { valor: "S", etiqueta: "S" },
  { valor: "M", etiqueta: "M" },
  { valor: "L", etiqueta: "L" },
  { valor: "XL", etiqueta: "XL" },
  { valor: "no sé", etiqueta: "No sé" },
];

const ETIQUETA_INICIAL = "Entrar al archivo";
const ESPERA_TOKEN_MS = 8000;
const PAUSA_REINTENTO_MS = 1500;

const ETIQUETA_CAMPO = "font-mono text-[12px] text-white/60";
const CAMPO =
  "w-full border-b border-white/30 bg-transparent py-2 text-[18px] text-white outline-none placeholder:text-white/30 focus:border-white";

type Campos = {
  nombre: string;
  whatsapp: string;
  correo: string;
  instagram: string;
  talla: string;
  dreamer: string;
  web: string;
  acepto: boolean;
};

type Resultado = {
  numero: number;
  archivo: string;
  archivoNumero: number;
  yaEstaba: boolean;
  telefono: string;
  instagram: string;
  expediente: string | null;
  instagramLink: string | null;
  codigo: string | null;
};

type Intento = { respuesta: RespuestaRegistro | null; huboReintento: boolean };

const CAMPOS_VACIOS: Campos = {
  nombre: "",
  whatsapp: "",
  correo: "",
  instagram: "",
  talla: "",
  dreamer: "",
  web: "",
  acepto: false,
};

// Sample data for the dev-only success preview; never sent anywhere.
const RESULTADO_DE_PRUEBA: Omit<Resultado, "archivo" | "archivoNumero"> = {
  numero: 23,
  yaEstaba: false,
  telefono: "4421234567",
  instagram: "drmrs.archive",
  expediente: null,
  instagramLink: null,
  codigo: null,
};

function esperar(ms: number): Promise<void> {
  return new Promise((resolver) => setTimeout(resolver, ms));
}

type FormularioRegistroProps = {
  drop: {
    nombre: string;
    numero: number;
    aperturaCorta: string;
  };
};

export function FormularioRegistro({ drop }: FormularioRegistroProps) {
  const [campos, setCampos] = useState<Campos>(CAMPOS_VACIOS);
  const [enviando, setEnviando] = useState(false);
  const [etiquetaBoton, setEtiquetaBoton] = useState(ETIQUETA_INICIAL);
  const [error, setError] = useState("");
  const [planB, setPlanB] = useState<{ href: string; texto: string } | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const registroTerminado = useRef(false);

  const origen = useRef("directo");
  const turnstile = useRef<HTMLDivElement>(null);
  const nombreRef = useRef<HTMLInputElement>(null);
  const whatsappRef = useRef<HTMLInputElement>(null);
  const correoRef = useRef<HTMLInputElement>(null);
  const instagramRef = useRef<HTMLInputElement>(null);

  const { obtenerToken, esperarToken, reiniciar } = useTurnstile(TURNSTILE_SITEKEY, turnstile);

  useEffect(() => {
    origen.current = detectarOrigen(window.location.search, document.referrer);
  }, []);

  useEffect(() => {
    registroTerminado.current = resultado !== null;
  }, [resultado]);

  // Next keeps this page's state while it is hidden after navigating away (Cache Components).
  // Leaving after a finished registration resets the form so coming back shows a fresh one.
  useEffect(() => {
    return () => {
      if (!registroTerminado.current) return;
      registroTerminado.current = false;
      setResultado(null);
      setCampos(CAMPOS_VACIOS);
      setError("");
      setPlanB(null);
    };
  }, []);

  function actualizar<K extends keyof Campos>(campo: K, valor: Campos[K]) {
    setCampos((anteriores) => ({ ...anteriores, [campo]: valor }));
  }

  function enfocar(fallo: ErrorRegistro) {
    if (fallo.campo === "nombre") nombreRef.current?.focus();
    if (fallo.campo === "whatsapp") whatsappRef.current?.focus();
    if (fallo.campo === "correo") correoRef.current?.focus();
    if (fallo.campo === "instagram") instagramRef.current?.focus();
  }

  function restaurarBoton() {
    setEnviando(false);
    setEtiquetaBoton(ETIQUETA_INICIAL);
  }

  async function registrar(datosIniciales: DatosRegistro): Promise<Intento> {
    let datos = datosIniciales;
    let respuesta: RespuestaRegistro | null = null;
    let huboReintento = false;

    for (let intento = 1; intento <= 2; intento++) {
      try {
        respuesta = await enviarRegistro(datos);
        if (
          respuesta.ok ||
          respuesta.error === "cerrado" ||
          respuesta.error === "datos" ||
          respuesta.error === "verificacion" ||
          respuesta.error === "instagram" ||
          respuesta.error === "limite"
        ) break;
      } catch {
        // Network failure or timeout: the retry below, or the plan B after it, handles it.
        respuesta = null;
      }
      if (intento === 1) {
        huboReintento = true;
        setEtiquetaBoton("Reintentando…");
        if (TURNSTILE_SITEKEY) {
          // Turnstile tokens are single use: the retry needs a fresh one.
          reiniciar();
          datos = { ...datos, token: await esperarToken(ESPERA_TOKEN_MS) };
        }
        await esperar(PAUSA_REINTENTO_MS);
      }
    }

    return { respuesta, huboReintento };
  }

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setError("");
    setPlanB(null);

    const nombre = campos.nombre.trim();
    const telefono = normalizarTelefono(campos.whatsapp);
    const correo = campos.correo.trim();
    const instagram = normalizarInstagram(campos.instagram);
    const fallo = validarRegistro({
      nombre,
      telefono,
      correo,
      instagram,
      talla: campos.talla,
      acepto: campos.acepto,
    });
    if (fallo) {
      setError(fallo.mensaje);
      enfocar(fallo);
      return;
    }

    // Honeypot filled: a bot. Show success without sending anything.
    if (campos.web) {
      setResultado({
        numero: 0,
        archivo: drop.nombre,
        archivoNumero: drop.numero,
        yaEstaba: false,
        telefono: "",
        instagram: "",
        expediente: null,
        instagramLink: null,
        codigo: null,
      });
      return;
    }

    setEnviando(true);
    setEtiquetaBoton("Registrando…");
    if (TURNSTILE_SITEKEY && !obtenerToken()) {
      setEtiquetaBoton("Verificando…");
      await esperarToken(ESPERA_TOKEN_MS);
      setEtiquetaBoton("Registrando…");
    }

    const { respuesta, huboReintento } = await registrar({
      nombre,
      whatsapp: "52" + telefono,
      correo,
      instagram,
      talla: campos.talla,
      dreamer: campos.dreamer.trim(),
      src: origen.current,
      acepto: true,
      web: campos.web,
      token: obtenerToken(),
    });

    restaurarBoton();

    if (respuesta?.ok) {
      // If the first attempt landed but its answer was lost, the retry reports "existente":
      // for the person it is still their first registration.
      setResultado({
        numero: respuesta.numero ?? 0,
        archivo: respuesta.archivo ?? drop.nombre,
        archivoNumero: respuesta.archivoNumero ?? drop.numero,
        yaEstaba: Boolean(respuesta.existente) && !huboReintento,
        telefono,
        instagram,
        expediente: respuesta.expediente ?? null,
        instagramLink: respuesta.instagram ?? null,
        codigo: respuesta.codigo ?? null,
      });
      return;
    }

    reiniciar();
    if (respuesta?.error === "cerrado") {
      setError("El registro de este archivo está cerrado.");
    } else if (respuesta?.error === "datos") {
      setError("Revisa tus datos: nombre, WhatsApp de 10 dígitos y talla.");
    } else if (respuesta?.error === "verificacion") {
      setError("No pudimos verificar que no eres bot. Intenta de nuevo.");
    } else if (respuesta?.error === "instagram") {
      setError("Ese Instagram ya está en el archivo con otro WhatsApp. Si es tuyo, escríbenos.");
      setPlanB(enlacePlanB(nombre, telefono, campos.talla));
    } else if (respuesta?.error === "limite") {
      setError("Demasiados intentos. Espera unos minutos y vuelve a intentar.");
    } else {
      setError("No se pudo registrar ahorita.");
      setPlanB(enlacePlanB(nombre, telefono, campos.talla));
    }
  }

  function corregir() {
    setResultado(null);
    setPlanB(null);
    reiniciar();
    requestAnimationFrame(() => {
      whatsappRef.current?.focus();
      whatsappRef.current?.select();
    });
  }

  return (
    <div className="mt-8">
      <form noValidate onSubmit={enviar} hidden={resultado !== null} className="relative grid gap-5 md:grid-cols-2 md:gap-x-8">
        <label className="grid gap-1">
          <span className={ETIQUETA_CAMPO}>nombre</span>
          <input
            ref={nombreRef}
            name="nombre"
            type="text"
            autoComplete="name"
            required
            maxLength={60}
            value={campos.nombre}
            onChange={(evento) => actualizar("nombre", evento.target.value)}
            className={CAMPO}
          />
        </label>

        <label className="grid gap-1">
          <span className={ETIQUETA_CAMPO}>whatsapp</span>
          <span className="flex items-baseline gap-3">
            <span className="border-b border-white/30 py-2 text-[18px] text-white/60">+52</span>
            <input
              ref={whatsappRef}
              name="whatsapp"
              type="tel"
              inputMode="numeric"
              autoComplete="tel-national"
              required
              maxLength={20}
              placeholder="10 dígitos"
              value={campos.whatsapp}
              onChange={(evento) => actualizar("whatsapp", limpiarEntradaTelefono(evento.target.value))}
              className={CAMPO}
            />
          </span>
        </label>

        <label className="grid gap-1">
          <span className={ETIQUETA_CAMPO}>
            correo <span className="text-white/40">(opcional)</span>
          </span>
          <input
            ref={correoRef}
            name="correo"
            type="email"
            autoComplete="email"
            maxLength={90}
            value={campos.correo}
            onChange={(evento) => actualizar("correo", evento.target.value)}
            className={CAMPO}
          />
        </label>

        <label className="grid gap-1">
          <span className={ETIQUETA_CAMPO}>
            instagram
          </span>
          <span className="flex items-baseline gap-3">
            <span className="border-b border-white/30 py-2 text-[18px] text-white/60">@</span>
            <input
              ref={instagramRef}
              name="instagram"
              required
              type="text"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              maxLength={31}
              placeholder="usuario"
              value={campos.instagram}
              onChange={(evento) => actualizar("instagram", evento.target.value)}
              className={CAMPO}
            />
          </span>
        </label>

        <label className="grid gap-1 md:col-span-2">
          <span className={ETIQUETA_CAMPO}>
            ¿quién debería estar en el archivo? <span className="text-white/40">(opcional)</span>
          </span>
          <input
            name="dreamer"
            type="text"
            maxLength={80}
            placeholder="Alguien que ya lo hizo"
            value={campos.dreamer}
            onChange={(evento) => actualizar("dreamer", evento.target.value)}
            className={CAMPO}
          />
        </label>

        <fieldset className="md:col-span-2">
          <legend className={ETIQUETA_CAMPO}>tu talla</legend>
          <div className="mt-3 grid grid-cols-5 border border-white/30">
            {TALLAS.map((talla) => (
              <label key={talla.valor} className="cursor-pointer border-r border-white/30 last:border-r-0">
                <input
                  type="radio"
                  name="talla"
                  value={talla.valor}
                  checked={campos.talla === talla.valor}
                  onChange={() => actualizar("talla", talla.valor)}
                  className="peer sr-only"
                />
                <span className="flex h-12 items-center justify-center text-[15px] font-medium text-white/60 transition-colors duration-200 hover:bg-white/10 hover:text-white peer-checked:bg-white peer-checked:text-azul peer-focus-visible:outline-2 peer-focus-visible:-outline-offset-2 peer-focus-visible:outline-white motion-reduce:transition-none">
                  {talla.etiqueta}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {/* Honeypot: people never see it; bots that fill every field reveal themselves. */}
        <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
          <label htmlFor="web">No llenar</label>
          <input
            id="web"
            name="web"
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={campos.web}
            onChange={(evento) => actualizar("web", evento.target.value)}
          />
        </div>

        <label className="flex items-start gap-3 text-[14px] leading-[1.5] text-white/80 md:col-span-2">
          <input
            type="checkbox"
            required
            checked={campos.acepto}
            onChange={(evento) => actualizar("acepto", evento.target.checked)}
            className="mt-1 size-4 shrink-0 accent-azul"
          />
          <span>
            Acepto el{" "}
            <Link href="/aviso-de-privacidad" target="_blank" className="underline underline-offset-4">
              aviso de privacidad
            </Link>{" "}
            y que drmr me escriba por WhatsApp sobre el archivo y los drops.
          </span>
        </label>

        <div ref={turnstile} className="md:col-span-2" />

        <button
          type="submit"
          disabled={enviando}
          className="group relative flex w-full items-center justify-between overflow-hidden bg-azul px-5 py-4 text-left text-[17px] font-medium text-white transition-colors duration-300 enabled:hover:text-azul enabled:focus-visible:text-azul focus-visible:outline-none disabled:opacity-60 motion-reduce:transition-none md:col-span-2"
        >
          <span
            aria-hidden="true"
            className="absolute inset-0 origin-left scale-x-0 bg-white transition-transform duration-300 ease-out group-enabled:group-hover:scale-x-100 group-enabled:group-focus-visible:scale-x-100 motion-reduce:transition-none"
          />
          <span className="relative">{etiquetaBoton}</span>
          <span
            aria-hidden="true"
            className="relative transition-transform duration-300 group-enabled:group-hover:translate-x-1 motion-reduce:transition-none"
          >
            →
          </span>
        </button>

        {error && (
          <div role="alert" className="grid gap-1 text-[14px] md:col-span-2">
            <p className="text-[#ff9b8f]">{error}</p>
            {planB && (
              <a
                href={planB.href}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium underline underline-offset-4"
              >
                {planB.texto}
              </a>
            )}
          </div>
        )}

        <p className="font-mono text-[12px] leading-[1.6] text-white/60 md:col-span-2">
          antes del {drop.aperturaCorta} te escribimos 3 veces por whatsapp: la fecha, el día antes y tu acceso.
        </p>
        {process.env.NODE_ENV === "development" && (
          <button
            type="button"
            onClick={() =>
              setResultado({
                ...RESULTADO_DE_PRUEBA,
                archivo: drop.nombre,
                archivoNumero: drop.numero,
              })
            }
            className="border border-dashed border-white/40 px-4 py-2 font-mono text-[12px] text-white/70 hover:text-white md:col-span-2"
          >
            Ver animación de éxito
          </button>
        )}
      </form>

      {resultado && (
        <ConfirmacionRegistro
          numero={resultado.numero}
          archivo={resultado.archivo}
          archivoNumero={resultado.archivoNumero}
          aperturaCorta={drop.aperturaCorta}
          yaEstaba={resultado.yaEstaba}
          telefono={resultado.telefono}
          instagram={resultado.instagram}
          expediente={resultado.expediente}
          instagramLink={resultado.instagramLink}
          codigo={resultado.codigo}
          onCorregir={corregir}
        />
      )}
    </div>
  );
}
