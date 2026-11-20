import type { BotVerifier } from "@/application/ports/bot-verifier";
import type { DropStore } from "@/application/drops/drop-store";
import type { RateLimitCheck } from "@/application/ports/rate-limit";
import { parseRegistrationRequest } from "@/contracts/registration";
import { expedientePath } from "@/domain/registration/expediente-link";

import type { ExpedienteCodes, RegistrationStore } from "./registration-store";

export interface SubmitRegistrationDependencies {
  drops: Pick<DropStore, "findOpenDrop">;
  store: RegistrationStore;
  codes: ExpedienteCodes;
  instagramLinkFor: (code: string | null) => Promise<string | null>;
  queueWelcome: (registrationId: string) => Promise<void>;
  botVerifier: BotVerifier;
  checkIp: RateLimitCheck;
  checkWhatsapp: RateLimitCheck;
}

export type SubmitRegistrationResult =
  | {
      kind: "registered";
      archivo: string;
      archivoNumero: number;
      registrationNumber: number;
      expedientePath: string;
      instagramLink: string | null;
      linkCode: string | null;
    }
  | {
      kind: "existing";
      archivo: string;
      archivoNumero: number;
      registrationNumber: number | null;
      expedientePath: string | null;
      instagramLink: string | null;
      linkCode: string | null;
    }
  | { kind: "invalid" }
  | { kind: "bot_rejected" }
  | { kind: "rate_limited"; retryAfterSeconds: number }
  | { kind: "instagram_taken" }
  | { kind: "closed" }
  | { kind: "unavailable" };

export async function submitRegistration(
  body: unknown,
  client: { remoteIp: string | null; rateLimitSubject: string },
  deps: SubmitRegistrationDependencies,
): Promise<SubmitRegistrationResult> {
  const ipLimit = await deps.checkIp(client.rateLimitSubject);
  if (!ipLimit.allowed) {
    return { kind: "rate_limited", retryAfterSeconds: ipLimit.retryAfterSeconds };
  }

  const drop = await deps.drops.findOpenDrop();
  if (drop === null) return { kind: "closed" };

  const parsed = parseRegistrationRequest(body);
  if (!parsed) {
    return { kind: "invalid" };
  }

  const botResult = await deps.botVerifier.verify({
    token: parsed.turnstileToken,
    remoteIp: client.remoteIp,
  });
  if (!botResult.ok) {
    return { kind: botResult.reason === "UNAVAILABLE" ? "unavailable" : "bot_rejected" };
  }

  const whatsappLimit = await deps.checkWhatsapp(parsed.registration.whatsappDigits);
  if (!whatsappLimit.allowed) {
    return { kind: "rate_limited", retryAfterSeconds: whatsappLimit.retryAfterSeconds };
  }

  const outcome = await deps.store.registerOrFind(parsed.registration, drop.id);
  if (outcome.kind === "closed") return { kind: "closed" };
  if (outcome.kind === "instagram_taken") {
    return { kind: "instagram_taken" };
  }

  if (outcome.kind === "existing") {
    // Without the Instagram match, the number would confirm that this WhatsApp is registered.
    // A plain chat link reveals nothing about the registration.
    if (!outcome.instagramMatches) {
      return {
        kind: "existing",
        archivo: outcome.drop.name,
        archivoNumero: outcome.drop.number,
        registrationNumber: null,
        expedientePath: null,
        instagramLink: await deps.instagramLinkFor(null),
        linkCode: null,
      };
    }

    return {
      kind: "existing",
      archivo: outcome.drop.name,
      archivoNumero: outcome.drop.number,
      registrationNumber: outcome.registrationNumber,
      expedientePath: expedientePath(
        outcome.drop.number,
        outcome.registrationNumber,
        deps.codes.codeFor(outcome.id, outcome.linkVersion),
      ),
      instagramLink: outcome.igLinkCode !== null ? await deps.instagramLinkFor(outcome.igLinkCode) : null,
      linkCode: outcome.igLinkCode,
    };
  }

  await deps.queueWelcome(outcome.id);

  return {
    kind: "registered",
    archivo: outcome.drop.name,
    archivoNumero: outcome.drop.number,
    registrationNumber: outcome.registrationNumber,
    expedientePath: expedientePath(
      outcome.drop.number,
      outcome.registrationNumber,
      deps.codes.codeFor(outcome.id, outcome.linkVersion),
    ),
    instagramLink: outcome.igLinkCode !== null ? await deps.instagramLinkFor(outcome.igLinkCode) : null,
    linkCode: outcome.igLinkCode,
  };
}
