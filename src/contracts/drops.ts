import { z } from "zod";

import { DROP_STATUSES, parseMexicoLocalInput } from "@/domain/drop/drop";

const localDate = z.string().transform((value, ctx) => {
  const date = parseMexicoLocalInput(value);
  if (date === null) {
    ctx.addIssue({ code: "custom", message: "Fecha inválida" });
    return z.NEVER;
  }
  return date;
});

const dropFields = {
  name: z.string().trim().min(1).max(60),
  registeredOpensAt: localDate,
  publicOpensAt: localDate,
  pieces: z.number().int().min(1).max(9999),
};

function validOpeningOrder(value: { registeredOpensAt: Date; publicOpensAt: Date }): boolean {
  return value.publicOpensAt >= value.registeredOpensAt;
}

export const createDropSchema = z.object({
  number: z.number().int().min(1).max(999),
  ...dropFields,
}).refine(validOpeningOrder, { path: ["publicOpensAt"], message: "La apertura pública debe ser posterior" });

export const updateDropSchema = z.object({
  dropId: z.uuid(),
  ...dropFields,
}).refine(validOpeningOrder, { path: ["publicOpensAt"], message: "La apertura pública debe ser posterior" });

export const dropStatusSchema = z.object({
  dropId: z.uuid(),
  expectedStatus: z.enum(DROP_STATUSES),
  newStatus: z.enum(DROP_STATUSES),
});

export type CreateDropInput = z.infer<typeof createDropSchema>;
export type UpdateDropInput = z.infer<typeof updateDropSchema>;
export type DropStatusInput = z.infer<typeof dropStatusSchema>;
