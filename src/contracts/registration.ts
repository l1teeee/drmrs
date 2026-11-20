import { z } from "zod";

import type { NewRegistration } from "@/domain/registration/registration";

const LINK_LIKE_TEXT =
  /:\/\/|www\.|@|[a-z0-9-]+\.(?:com|net|org|mx|io|co|app|me|ly|link|xyz|info|site|online|store|shop|gg|tv)\b/i;

export const registrationRequestSchema = z.object({
  nombre: z
    .string()
    .refine((value) => !/[\p{Cc}\p{Cf}]/u.test(value))
    .refine((value) => !LINK_LIKE_TEXT.test(value))
    .transform((value) => value.trim().replace(/\s+/g, " "))
    .pipe(z.string().min(2).max(80)),
  whatsapp: z.string().length(12).regex(/^52\d{10}$/),
  correo: z
    .string()
    .trim()
    .toLowerCase()
    .max(254)
    .refine(
      (value) => value === "" || (value.length <= 254 && /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(value)),
    )
    .transform((value) => value || null),
  instagram: z
    .string()
    .trim()
    .transform((value) => value.replace(/^@/, "").toLowerCase())
    .pipe(z.string().regex(/^[a-z0-9._]{1,30}$/)),
  talla: z.enum(["S", "M", "L", "XL", "no sé"])
    .transform((value) => value === "no sé" ? "NO_SE" as const : value),
  dreamer: z
    .string()
    .refine((value) => !/[\p{Cc}\p{Cf}]/u.test(value))
    .refine((value) => !LINK_LIKE_TEXT.test(value))
    .trim()
    .max(80)
    .optional()
    .transform((value) => value || null),
  src: z
    .string()
    .optional()
    .transform((value) => value?.trim().replace(/[^A-Za-z0-9._:/-]/g, "").slice(0, 40) || "directo"),
  acepto: z.literal(true),
  web: z.literal("").optional(),
  token: z.string().max(2048),
});

export function parseRegistrationRequest(
  body: unknown,
): { registration: NewRegistration; turnstileToken: string } | null {
  const parsed = registrationRequestSchema.safeParse(body);
  if (!parsed.success) {
    return null;
  }

  const value = parsed.data;
  return {
    registration: {
      fullName: value.nombre,
      instagramHandle: value.instagram,
      whatsappDigits: value.whatsapp,
      email: value.correo,
      size: value.talla,
      archiveNominee: value.dreamer,
      source: value.src,
    },
    turnstileToken: value.token,
  };
}
