import { createHmac, timingSafeEqual } from "node:crypto";

import type { ExpedienteCodes } from "@/application/registration/registration-store";

import { getEnv } from "../config/env";

const BASE32_ALPHABET = "abcdefghijklmnopqrstuvwxyz234567";

function base32(bytes: Uint8Array): string {
  let value = 0;
  let bits = 0;
  let encoded = "";

  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      encoded += BASE32_ALPHABET[(value >>> bits) & 31];
    }
    value &= (1 << bits) - 1;
  }

  if (bits > 0) {
    encoded += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }

  return encoded;
}

export const expedienteCodes: ExpedienteCodes = {
  codeFor(id, linkVersion) {
    const digest = createHmac("sha256", getEnv().APP_SECRET)
      .update(`expediente:${id}:${linkVersion}`)
      .digest();
    return base32(digest).slice(0, 10);
  },

  matches(id, linkVersion, code) {
    const expected = Buffer.from(expedienteCodes.codeFor(id, linkVersion));
    const actual = Buffer.from(code);
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  },
};
