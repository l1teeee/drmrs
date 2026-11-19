export function formatRegistrationNumber(n: number): string {
  return String(n).padStart(4, "0");
}

export function expedientePath(registrationNumber: number, code: string): string {
  return `/expediente/${formatRegistrationNumber(registrationNumber)}-${code}`;
}

export function parseExpedienteSlug(
  slug: string,
): { registrationNumber: number; code: string } | null {
  const match = /^(\d{4})-([a-z2-7]{10})$/.exec(slug);
  if (!match || match[0] !== slug) {
    return null;
  }

  const registrationNumber = Number(match[1]);
  if (registrationNumber < 1 || registrationNumber > 9999) {
    return null;
  }

  return { registrationNumber, code: match[2] };
}
