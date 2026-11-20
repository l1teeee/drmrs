export const TEMPLATE_KEYS = ["BIENVENIDA", "CAMBIO_ESTADO", "RECORDATORIO_DROP", "ACTIVACION"] as const;
export type TemplateKey = (typeof TEMPLATE_KEYS)[number];

export const TEMPLATE_VARIABLES = ["nombre", "numero", "talla", "estado", "link", "fecha_drop"] as const;
export const DROP_DATE_LABEL = "viernes 04.12 a las 19:00";

const placeholderPattern = /\{([^{}]+)\}/g;

export function findUnknownVariables(body: string): string[] {
  const allowed = new Set<string>(TEMPLATE_VARIABLES);
  const unknown = new Set<string>();

  for (const match of body.matchAll(placeholderPattern)) {
    const variable = match[1]!;
    if (!allowed.has(variable)) {
      unknown.add(variable);
    }
  }

  return [...unknown];
}

export function renderMessageTemplate(body: string, values: Record<string, string>): string {
  return body
    .replace(placeholderPattern, (_, variable: string) => values[variable] ?? "")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
