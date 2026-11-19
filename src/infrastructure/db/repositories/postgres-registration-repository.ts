import type {
  ExpedienteRecord,
  RegisterOutcome,
  RegistrationStore,
} from "@/application/registration/registration-store";
import type { PieceStatus, Size } from "@/domain/registration/registration";

import { generateLinkCode } from "../../crypto/link-code-generator";
import { protectRegistrationContact, whatsappHashFor } from "../../registration/registration-pii";
import { getPool } from "../client";
import { inTransaction } from "../transaction";

export const REGISTRATION_NUMBER_LOCK = "drmr_registration_number";

interface RegistrationRow {
  id: string;
  registration_number: number;
  link_version: number;
  ig_link_code: string | null;
}

interface ExistingRegistrationRow extends RegistrationRow {
  instagram_handle: string;
}

interface ExpedienteRow extends RegistrationRow {
  full_name: string;
  size: Size;
  piece_status: PieceStatus;
}

export const postgresRegistrationRepository: RegistrationStore = {
  async registerOrFind(registration): Promise<RegisterOutcome> {
    return inTransaction<RegisterOutcome>(
      getPool(),
      ["SET LOCAL lock_timeout = '3s'", "SET LOCAL statement_timeout = '5s'"],
      async (client) => {
        await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [REGISTRATION_NUMBER_LOCK]);

        const whatsappHash = whatsappHashFor(registration.whatsappDigits);
        const existing = await client.query<ExistingRegistrationRow>(
          "SELECT id, registration_number, link_version, ig_link_code, instagram_handle FROM registrations WHERE whatsapp_hash = $1",
          [whatsappHash],
        );
        const match = existing.rows[0];
        if (match) {
          return {
            kind: "existing",
            id: match.id,
            registrationNumber: match.registration_number,
            linkVersion: match.link_version,
            igLinkCode: match.ig_link_code,
            instagramMatches: match.instagram_handle === registration.instagramHandle,
          };
        }

        const instagram = await client.query(
          "SELECT 1 FROM registrations WHERE instagram_handle = $1",
          [registration.instagramHandle],
        );
        if (instagram.rows.length > 0) {
          return { kind: "instagram_taken" };
        }

        const next = await client.query<{ next: number }>(
          "SELECT COALESCE(MAX(registration_number), 0) + 1 AS next FROM registrations",
        );
        const registrationNumber = next.rows[0]!.next;
        if (registrationNumber > 9999) {
          throw new Error("registration numbers exhausted");
        }

        const { whatsappCiphertext, emailCiphertext } = protectRegistrationContact(
          registration.whatsappDigits,
          registration.email,
        );
        let created: RegistrationRow;
        for (let attempt = 0; ; attempt += 1) {
          await client.query("SAVEPOINT registration_link_code");
          try {
            const inserted = await client.query<RegistrationRow>(
              `INSERT INTO registrations (
                 registration_number, full_name, instagram_handle,
                 whatsapp_ciphertext, whatsapp_hash, email_ciphertext,
                 size, archive_nominee, source, origin, privacy_accepted_at, ig_link_code
               ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'WEB', now(), $10)
               RETURNING id, registration_number, link_version, ig_link_code`,
              [
                registrationNumber,
                registration.fullName,
                registration.instagramHandle,
                whatsappCiphertext,
                whatsappHash,
                emailCiphertext,
                registration.size,
                registration.archiveNominee,
                registration.source,
                generateLinkCode(),
              ],
            );
            await client.query("RELEASE SAVEPOINT registration_link_code");
            created = inserted.rows[0]!;
            break;
          } catch (error) {
            await client.query("ROLLBACK TO SAVEPOINT registration_link_code");
            await client.query("RELEASE SAVEPOINT registration_link_code");
            if (
              attempt >= 3 || typeof error !== "object" || error === null ||
              !("code" in error) || error.code !== "23505" ||
              !("constraint" in error) || error.constraint !== "registrations_ig_link_code_uq"
            ) throw error;
          }
        }
        await client.query(
          `INSERT INTO audit_logs (action, entity_type, entity_id, metadata)
           VALUES ('REGISTRATION_CREATED', 'registration', $1, '{"origin":"WEB"}'::jsonb)`,
          [created.id],
        );

        return {
          kind: "created",
          id: created.id,
          registrationNumber: created.registration_number,
          linkVersion: created.link_version,
          igLinkCode: created.ig_link_code,
        };
      },
    );
  },

  async findByNumber(registrationNumber): Promise<ExpedienteRecord | null> {
    const result = await getPool().query<ExpedienteRow>(
      "SELECT id, registration_number, full_name, size, piece_status, link_version FROM registrations WHERE registration_number = $1",
      [registrationNumber],
    );
    const record = result.rows[0];
    if (!record) {
      return null;
    }

    return {
      id: record.id,
      registrationNumber: record.registration_number,
      fullName: record.full_name,
      size: record.size,
      pieceStatus: record.piece_status,
      linkVersion: record.link_version,
    };
  },
};
