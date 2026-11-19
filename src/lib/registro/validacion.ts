export type CamposRegistro = {
  nombre: string;
  telefono: string;
  correo: string;
  instagram: string;
  talla: string;
  acepto: boolean;
};

export type ErrorRegistro = {
  campo: "nombre" | "whatsapp" | "correo" | "instagram" | "talla" | "acepto";
  mensaje: string;
};

export function validarRegistro(campos: CamposRegistro): ErrorRegistro | null {
  if (campos.nombre.length < 2) {
    return { campo: "nombre", mensaje: "Escribe tu nombre." };
  }
  if (campos.telefono.length !== 10) {
    return {
      campo: "whatsapp",
      mensaje: "Tu WhatsApp debe tener 10 dígitos (sin el +52).",
    };
  }
  if (campos.correo && !/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(campos.correo)) {
    return { campo: "correo", mensaje: "Revisa tu correo." };
  }
  if (!campos.instagram) {
    return { campo: "instagram", mensaje: "Escribe tu usuario de Instagram." };
  }
  if (!/^[A-Za-z0-9._]{1,30}$/.test(campos.instagram)) {
    return { campo: "instagram", mensaje: "Revisa tu usuario de Instagram." };
  }
  if (!campos.talla) {
    return { campo: "talla", mensaje: "Elige tu talla (o “No sé”)." };
  }
  if (!campos.acepto) {
    return {
      campo: "acepto",
      mensaje: "Falta aceptar el aviso de privacidad.",
    };
  }
  return null;
}
