import { z } from "zod";

import {
  databaseEnvFields,
  isLocalDatabaseHost,
  validateDatabaseConfiguration,
} from "./database-env";

const optionalString = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().optional(),
);

const turnstileTestKeyPrefixes = ["1x0000", "2x0000", "3x0000"];

const optionalTokenKey = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string()
    .refine(
      (value) =>
        /^(?:[A-Za-z0-9+/]{4}){10}[A-Za-z0-9+/]{3}=$/.test(value) &&
        Buffer.from(value, "base64").length === 32,
      "must be base64 for exactly 32 bytes",
    )
    .transform((value) => Buffer.from(value, "base64"))
    .optional(),
);

function isTurnstileTestKey(value: string | undefined): boolean {
  return Boolean(value && turnstileTestKeyPrefixes.some((prefix) => value.startsWith(prefix)));
}

function isLocalHost(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return isLocalDatabaseHost(normalized) || normalized === "0.0.0.0" || normalized.endsWith(".localhost");
}

export function isProtectedEnvironment(environment: {
  APP_ENV: "local" | "test" | "preview" | "production";
}): boolean {
  return environment.APP_ENV === "preview" || environment.APP_ENV === "production";
}

const serverEnvSchema = z
  .object({
    ...databaseEnvFields,
    // Stop malformed URLs before the shared refinements call the URL constructor.
    DATABASE_URL: z.url().pipe(databaseEnvFields.DATABASE_URL),
    APP_ENV: z.enum(["local", "test", "preview", "production"]).default("local"),
    VERCEL: z.string().optional(),
    VERCEL_ENV: z.enum(["production", "preview", "development"]).optional(),
    DATABASE_POOL_MAX: z.coerce.number().int().positive().default(10),
    APP_SECRET: z.string().min(32),
    PII_ENCRYPTION_KEY: z
      .string()
      .refine(
        (value) =>
          /^(?:[A-Za-z0-9+/]{4}){10}[A-Za-z0-9+/]{3}=$/.test(value) &&
          Buffer.from(value, "base64").length === 32,
        "must be base64 for exactly 32 bytes",
      )
      .transform((value) => Buffer.from(value, "base64")),
    APP_BASE_URL: z.url().transform((value) => value.replace(/\/$/, "")),
    RATE_LIMIT_MODE: z.enum(["enforce", "disabled"]).default("enforce"),
    BOT_PROTECTION_MODE: z.enum(["turnstile", "disabled"]).default("turnstile"),
    MESSAGING_MODE: z.enum(["disabled", "log", "instagram"]).default("disabled"),
    META_APP_ID: optionalString.pipe(z.string().regex(/^\d+$/).optional()),
    META_APP_SECRET: optionalString.pipe(z.string().min(16).optional()),
    INSTAGRAM_LOGIN_CONFIG_ID: optionalString.pipe(z.string().regex(/^\d+$/).optional()),
    META_WEBHOOK_VERIFY_TOKEN: optionalString.pipe(z.string().min(16).optional()),
    INSTAGRAM_TOKEN_ENCRYPTION_KEY: optionalTokenKey,
    INSTAGRAM_BUSINESS_USERNAME: optionalString.pipe(z.string().regex(/^[a-z0-9._]{1,30}$/).optional()),
    META_GRAPH_API_BASE_URL: z.preprocess(
      (value) => (value === "" ? undefined : value),
      z.url().refine(
        (value) => new URL(value).protocol === "https:" && /\/v\d+\.\d+$/.test(value),
        "must use https and end with an API version",
      ).default("https://graph.facebook.com/v27.0"),
    ),
    CRON_SECRET: optionalString,
    TURNSTILE_SECRET_KEY: optionalString,
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: optionalString,
    NEXT_PUBLIC_SITE_URL: optionalString.pipe(z.url().optional()),
    TURNSTILE_ALLOWED_HOSTNAMES: z.string().default("").transform((value) =>
      value
        .split(",")
        .map((hostname) => hostname.trim().toLowerCase())
        .filter(Boolean),
    ),
  })
  .superRefine((value, context) => {
    validateDatabaseConfiguration(value, context);
    const protectedEnvironment = isProtectedEnvironment(value);
    if (protectedEnvironment && value.MESSAGING_MODE === "log") {
      context.addIssue({
        code: "custom",
        path: ["MESSAGING_MODE"],
        message: "cannot use log in preview or production",
      });
    }
    if (value.MESSAGING_MODE === "instagram") {
      for (const field of [
        "META_APP_ID",
        "META_APP_SECRET",
        "INSTAGRAM_LOGIN_CONFIG_ID",
        "META_WEBHOOK_VERIFY_TOKEN",
        "INSTAGRAM_TOKEN_ENCRYPTION_KEY",
        "INSTAGRAM_BUSINESS_USERNAME",
      ] as const) {
        if (!value[field]) {
          context.addIssue({
            code: "custom",
            path: [field],
            message: "is required when MESSAGING_MODE is instagram",
          });
        }
      }
      if (protectedEnvironment && (!value.CRON_SECRET || value.CRON_SECRET.length < 32)) {
        context.addIssue({
          code: "custom",
          path: ["CRON_SECRET"],
          message: "requires at least 32 characters for instagram in preview or production",
        });
      }
    }
    const expectedAppEnvironment = {
      production: "production",
      preview: "preview",
      development: "local",
    } as const;

    if (value.VERCEL !== undefined && !value.VERCEL_ENV) {
      context.addIssue({
        code: "custom",
        path: ["VERCEL_ENV"],
        message: "is required when VERCEL is set",
      });
    }

    if (value.VERCEL_ENV && value.APP_ENV !== expectedAppEnvironment[value.VERCEL_ENV]) {
      context.addIssue({
        code: "custom",
        path: ["APP_ENV"],
        message: `must be ${expectedAppEnvironment[value.VERCEL_ENV]} when VERCEL_ENV is ${value.VERCEL_ENV}`,
      });
    }

    if (protectedEnvironment && value.APP_SECRET.startsWith("local-only")) {
      context.addIssue({
        code: "custom",
        path: ["APP_SECRET"],
        message: "cannot use a local-only value in preview or production",
      });
    }

    if (protectedEnvironment && value.DATABASE_SSL_MODE === "disable") {
      context.addIssue({
        code: "custom",
        path: ["DATABASE_SSL_MODE"],
        message: "cannot be disabled in preview or production",
      });
    }

    if (
      protectedEnvironment &&
      isLocalDatabaseHost(new URL(value.DATABASE_URL).hostname)
    ) {
      context.addIssue({
        code: "custom",
        path: ["DATABASE_URL"],
        message: "cannot point to a local host in preview or production",
      });
    }

    const appBaseUrl = new URL(value.APP_BASE_URL);
    if (protectedEnvironment && appBaseUrl.protocol !== "https:") {
      context.addIssue({
        code: "custom",
        path: ["APP_BASE_URL"],
        message: "must use https in preview or production",
      });
    }

    if (protectedEnvironment && isLocalHost(appBaseUrl.hostname)) {
      context.addIssue({
        code: "custom",
        path: ["APP_BASE_URL"],
        message: "cannot use a local host in preview or production",
      });
    }

    if (protectedEnvironment && value.RATE_LIMIT_MODE === "disabled") {
      context.addIssue({
        code: "custom",
        path: ["RATE_LIMIT_MODE"],
        message: "cannot be disabled in preview or production",
      });
    }

    if (protectedEnvironment && value.BOT_PROTECTION_MODE === "disabled") {
      context.addIssue({
        code: "custom",
        path: ["BOT_PROTECTION_MODE"],
        message: "cannot be disabled in preview or production",
      });
    }

    if (protectedEnvironment && isTurnstileTestKey(value.TURNSTILE_SECRET_KEY)) {
      context.addIssue({
        code: "custom",
        path: ["TURNSTILE_SECRET_KEY"],
        message: "cannot use a Cloudflare test key in preview or production",
      });
    }

    if (protectedEnvironment && isTurnstileTestKey(value.NEXT_PUBLIC_TURNSTILE_SITE_KEY)) {
      context.addIssue({
        code: "custom",
        path: ["NEXT_PUBLIC_TURNSTILE_SITE_KEY"],
        message: "cannot use a Cloudflare test key in preview or production",
      });
    }

    if (protectedEnvironment) {
      if (!value.NEXT_PUBLIC_SITE_URL) {
        context.addIssue({
          code: "custom",
          path: ["NEXT_PUBLIC_SITE_URL"],
          message: "is required in preview or production",
        });
      } else if (new URL(value.NEXT_PUBLIC_SITE_URL).protocol !== "https:") {
        context.addIssue({
          code: "custom",
          path: ["NEXT_PUBLIC_SITE_URL"],
          message: "must use https in preview or production",
        });
      }
    }

    if (protectedEnvironment && value.TURNSTILE_ALLOWED_HOSTNAMES.some(isLocalHost)) {
      context.addIssue({
        code: "custom",
        path: ["TURNSTILE_ALLOWED_HOSTNAMES"],
        message: "cannot contain a local host in preview or production",
      });
    }

    if (value.BOT_PROTECTION_MODE === "turnstile") {
      if (!value.TURNSTILE_SECRET_KEY) {
        context.addIssue({
          code: "custom",
          path: ["TURNSTILE_SECRET_KEY"],
          message: "is required when BOT_PROTECTION_MODE is turnstile",
        });
      }

      if (!value.NEXT_PUBLIC_TURNSTILE_SITE_KEY) {
        context.addIssue({
          code: "custom",
          path: ["NEXT_PUBLIC_TURNSTILE_SITE_KEY"],
          message: "is required when BOT_PROTECTION_MODE is turnstile",
        });
      }

      if (value.TURNSTILE_ALLOWED_HOSTNAMES.length === 0) {
        context.addIssue({
          code: "custom",
          path: ["TURNSTILE_ALLOWED_HOSTNAMES"],
          message: "must contain at least one hostname when BOT_PROTECTION_MODE is turnstile",
        });
      }
    }
  });

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let environment: ServerEnv | undefined;

export function getEnv(): ServerEnv {
  if (environment) {
    return environment;
  }

  const result = serverEnvSchema.safeParse(process.env);
  if (!result.success) {
    const fields = [...new Set(result.error.issues.map((issue) => issue.path.join(".") || "environment"))];
    throw new Error(`Invalid server environment: ${fields.join(", ")}`);
  }

  environment = result.data;
  return environment;
}
