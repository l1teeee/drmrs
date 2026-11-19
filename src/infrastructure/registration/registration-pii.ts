import { getEnv } from "../config/env";
import { keyedHash } from "../crypto/keyed-hash";
import { encryptSecret } from "../crypto/secret-box";

export function whatsappHashFor(digits: string): string {
  return keyedHash(`whatsapp:${digits}`);
}

export function protectRegistrationContact(
  whatsappDigits: string,
  email: string | null,
): { whatsappCiphertext: string; whatsappHash: string; emailCiphertext: string | null } {
  const environment = getEnv();
  return {
    whatsappCiphertext: encryptSecret(
      whatsappDigits,
      environment.PII_ENCRYPTION_KEY,
      "registrations.whatsapp",
    ),
    whatsappHash: whatsappHashFor(whatsappDigits),
    emailCiphertext: email
      ? encryptSecret(email, environment.PII_ENCRYPTION_KEY, "registrations.email")
      : null,
  };
}
