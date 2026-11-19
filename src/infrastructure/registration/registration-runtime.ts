import type { ExpedienteDependencies } from "@/application/registration/get-expediente";
import type { SubmitRegistrationDependencies } from "@/application/registration/submit-registration";

import { createBotVerifier } from "../bot-protection/turnstile-verifier";
import { getEnv } from "../config/env";
import { expedienteCodes } from "../crypto/expediente-code";
import { postgresRegistrationRepository } from "../db/repositories/postgres-registration-repository";
import { consume, RATE_LIMITS } from "../rate-limit/postgres-rate-limiter";

function instagramLinkFor(code: string): string | null {
  const { MESSAGING_MODE: mode, INSTAGRAM_BUSINESS_USERNAME: username } = getEnv();
  if (!username || (mode !== "instagram" && mode !== "log")) {
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
