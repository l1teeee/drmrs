export function formatRegistrationNumber(n: number): string {
  return String(n).padStart(4, "0");
}

export function expedientePath(dropNumber: number, registrationNumber: number, code: string): string {
  return `/expediente/${String(dropNumber).padStart(3, "0")}-${formatRegistrationNumber(registrationNumber)}-${code}`;
}

export function parseExpedienteSlug(
  slug: string,
): { dropNumber: number; registrationNumber: number; code: string } | null {
  const match = /^(?:(\d{3})-)?(\d{4})-([a-z2-7]{10})$/.exec(slug);
  if (!match || match[0] !== slug) {
    return null;
  }

  const dropNumber = match[1] === undefined ? 1 : Number(match[1]);
  const registrationNumber = Number(match[2]);
  if (dropNumber < 1 || registrationNumber < 1 || registrationNumber > 9999) {
    return null;
  }

  return { dropNumber, registrationNumber, code: match[3] };
}
