import { z } from "zod";

import { DROP_STATUSES, hoursFromDuration, parseMexicoLocalInput } from "@/domain/drop/drop";

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
  registrationAmount: z.union([z.number().int().min(1).max(2160), z.literal("")]).optional(),
  registrationUnit: z.enum(["horas", "dias"]).optional(),
};

function validOpeningOrder(value: { registeredOpensAt: Date; publicOpensAt: Date }): boolean {
  return value.publicOpensAt >= value.registeredOpensAt;
}

function withRegistrationHours<T extends {
  registrationAmount?: number | "";
  registrationUnit?: "horas" | "dias";
}>(value: T, ctx: z.RefinementCtx) {
  const { registrationAmount, registrationUnit, ...fields } = value;
  let registrationHours: number | null = null;
  if (registrationAmount !== undefined && registrationAmount !== "") {
    if (registrationUnit === undefined) {
      ctx.addIssue({ code: "custom", path: ["registrationUnit"], message: "Elige horas o días" });
      return z.NEVER;
    }
    registrationHours = hoursFromDuration(registrationAmount, registrationUnit);
    if (registrationHours < 1 || registrationHours > 2160) {
      ctx.addIssue({ code: "custom", path: ["registrationAmount"], message: "La duración debe ser de 1 a 2160 horas" });
      return z.NEVER;
    }
  }
  return { ...fields, registrationHours };
}

export const createDropSchema = z.object({
  number: z.number().int().min(1).max(999),
  ...dropFields,
}).refine(validOpeningOrder, { path: ["publicOpensAt"], message: "La apertura pública debe ser posterior" })
  .transform(withRegistrationHours);

export const updateDropSchema = z.object({
  dropId: z.uuid(),
  ...dropFields,
}).refine(validOpeningOrder, { path: ["publicOpensAt"], message: "La apertura pública debe ser posterior" })
  .transform(withRegistrationHours);

export const dropStatusSchema = z.object({
  dropId: z.uuid(),
  expectedStatus: z.enum(DROP_STATUSES),
  newStatus: z.enum(DROP_STATUSES),
});

export type CreateDropInput = z.infer<typeof createDropSchema>;
export type UpdateDropInput = z.infer<typeof updateDropSchema>;
export type DropStatusInput = z.infer<typeof dropStatusSchema>;
