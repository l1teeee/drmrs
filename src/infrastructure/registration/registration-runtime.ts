import type { ExpedienteDependencies } from "@/application/registration/get-expediente";
import type { SubmitRegistrationDependencies } from "@/application/registration/submit-registration";

import { createBotVerifier } from "../bot-protection/turnstile-verifier";
import { getEnv } from "../config/env";
import { expedienteCodes } from "../crypto/expediente-code";
import { postgresInstagramConnectionRepository } from "../db/repositories/postgres-instagram-connection-repository";
import { postgresRegistrationRepository } from "../db/repositories/postgres-registration-repository";
import { log, safeErrorCode } from "../observability/logger";
import { consume, RATE_LIMITS } from "../rate-limit/postgres-rate-limiter";

async function connectedInstagramUsername(): Promise<string | null> {
  try {
    const connection = await postgresInstagramConnectionRepository.find();
    return connection?.username ?? null;
  } catch (error) {
    log("error", "instagram_link_username_failed", { code: safeErrorCode(error) });
    return null;
  }
}

async function instagramLinkFor(code: string): Promise<string | null> {
  const { MESSAGING_MODE: mode, INSTAGRAM_BUSINESS_USERNAME: configuredUsername } = getEnv();
  if (mode !== "instagram" && mode !== "log") {
    return null;
  }
  const username = configuredUsername ?? (await connectedInstagramUsername());
  if (!username) {
    return null;
  }
  return `https://ig.me/m/${username}?ref=${code}`;
}

export function registrationDependencies(): SubmitRegistrationDependencies {
  return {
    store: postgresRegistrationRepository,
    codes: expedienteCodes,
    instagramLinkFor,
    botVerifier: createBotVerifier(),
    checkIp: (subject) => consume({ ...RATE_LIMITS.registrationIp, subject }),
    checkWhatsapp: (subject) => consume({ ...RATE_LIMITS.registrationWhatsapp, subject }),
  };
}

export function expedienteDependencies(): ExpedienteDependencies {
  return {
    store: postgresRegistrationRepository,
    codes: expedienteCodes,
    checkLookup: (subject) => consume({ ...RATE_LIMITS.expedienteIp, subject }),
  };
}
