import { z } from "zod";

import { TEMPLATE_KEYS } from "@/domain/messaging/message-template";
import { PIECE_STATUSES, SIZES } from "@/domain/registration/registration";

export const listFiltersSchema = z.object({
  q: z.string().trim().max(60).optional(),
  estado: z.enum(PIECE_STATUSES).optional(),
  talla: z.enum(SIZES).optional(),
});

export const registrationIdSchema = z.object({ registrationId: z.uuid() });

export const changeStatusSchema = registrationIdSchema.extend({
  expectedStatus: z.enum(PIECE_STATUSES),
  newStatus: z.enum(PIECE_STATUSES),
}).refine((value) => value.expectedStatus !== value.newStatus);

export const templateUpdateSchema = z.object({
  key: z.enum(TEMPLATE_KEYS),
  body: z.string()
    .refine((value) => !/\p{Cc}/u.test(value.replaceAll("\n", "")))
    .trim().min(1).max(1000),
});

export const auditPageSchema = z.object({ before: z.number().int().positive().optional() });

export type ListFilters = z.infer<typeof listFiltersSchema>;
export type ChangeStatusInput = z.infer<typeof changeStatusSchema>;
export type TemplateUpdateInput = z.infer<typeof templateUpdateSchema>;
