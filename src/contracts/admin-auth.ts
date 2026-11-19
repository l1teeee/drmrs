import { z } from "zod";

export const signInSchema = z.object({
  email: z.string().trim().toLowerCase().max(254).pipe(z.email()),
  password: z.string().min(1).max(256).refine((value) => !/\p{Cc}/u.test(value)),
});
