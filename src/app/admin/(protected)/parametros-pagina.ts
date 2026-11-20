const PAGE_PARAM = /^[1-9]\d{0,5}$/;

export function parsePagina(raw: string | string[] | undefined): number {
  return typeof raw === "string" && PAGE_PARAM.test(raw) ? Number(raw) : 1;
}

export function hrefPagina(
  path: string,
  params: Record<string, string | undefined>,
  key: string,
  pagina: number,
): string {
  const query = new URLSearchParams();
  for (const [name, value] of Object.entries(params)) {
    if (value) query.set(name, value);
  }
  if (pagina > 1) query.set(key, String(pagina));
  const text = query.toString();
  return text ? `${path}?${text}` : path;
}
