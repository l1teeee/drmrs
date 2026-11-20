import type {
  ExpedienteRecord,
  RegisterOutcome,
  RegistrationStore,
} from "@/application/registration/registration-store";
import { registrationNumberLockKey } from "@/application/registration/registration-store";
import type { DropStatus } from "@/domain/drop/drop";
import type { PieceStatus, Size } from "@/domain/registration/registration";

import { generateLinkCode } from "../../crypto/link-code-generator";
import { protectRegistrationContact, whatsappHashFor } from "../../registration/registration-pii";
import { getPool } from "../client";
import { inTransaction } from "../transaction";

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
  drop_number: number;
  drop_name: string;
  drop_registered_opens_at: Date;
  drop_public_opens_at: Date;
  drop_pieces: number;
  full_name: string;
  size: Size;
  piece_status: PieceStatus;
}

export const postgresRegistrationRepository: RegistrationStore = {
  async registerOrFind(registration, dropId): Promise<RegisterOutcome> {
    return inTransaction<RegisterOutcome>(
      getPool(),
      ["SET LOCAL lock_timeout = '3s'", "SET LOCAL statement_timeout = '5s'"],
      async (client) => {
        const drops = await client.query<{ status: DropStatus; number: number; name: string }>(
          "SELECT status, number, name FROM drops WHERE id = $1 FOR SHARE", [dropId],
        );
        const dropRow = drops.rows[0];
        if (!dropRow || dropRow.status !== "REGISTRO") return { kind: "closed" };
        const drop = { number: dropRow.number, name: dropRow.name };
        await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [registrationNumberLockKey(dropId)]);

        const whatsappHash = whatsappHashFor(registration.whatsappDigits);
        const existing = await client.query<ExistingRegistrationRow>(
          "SELECT id, registration_number, link_version, ig_link_code, instagram_handle FROM registrations WHERE whatsapp_hash = $1 AND drop_id = $2",
          [whatsappHash, dropId],
        );
        const match = existing.rows[0];
        if (match) {
          return {
            kind: "existing",
            drop,
            id: match.id,
            registrationNumber: match.registration_number,
            linkVersion: match.link_version,
            igLinkCode: match.ig_link_code,
            instagramMatches: match.instagram_handle === registration.instagramHandle,
          };
        }

        const instagram = await client.query(
          "SELECT 1 FROM registrations WHERE instagram_handle = $1 AND drop_id = $2",
          [registration.instagramHandle, dropId],
        );
        if (instagram.rows.length > 0) {
          return { kind: "instagram_taken" };
        }

        const next = await client.query<{ next: number }>(
          "SELECT COALESCE(MAX(registration_number), 0) + 1 AS next FROM registrations WHERE drop_id = $1",
          [dropId],
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
                 size, archive_nominee, source, origin, privacy_accepted_at, ig_link_code, drop_id
               ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'WEB', now(), $10, $11)
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
                dropId,
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
        const inherited = await client.query<{ messaging_contact_id: string }>(
          `SELECT p.messaging_contact_id
           FROM registrations p JOIN drops pd ON pd.id = p.drop_id
           WHERE p.instagram_handle = $1 AND p.whatsapp_hash = $2 AND p.drop_id <> $3
             AND p.messaging_contact_id IS NOT NULL
           ORDER BY pd.number DESC LIMIT 1`,
          [registration.instagramHandle, whatsappHash, dropId],
        );
        const contact = inherited.rows[0];
        if (contact) {
          await client.query("SAVEPOINT registration_inherit");
          try {
            await client.query("SELECT id FROM messaging_contacts WHERE id = $1 FOR UPDATE", [contact.messaging_contact_id]);
            const linked = await client.query(
              `UPDATE registrations SET messaging_contact_id = $1, contact_linked_by = 'USERNAME', updated_at = now()
               WHERE id = $2 AND NOT EXISTS (
                 SELECT 1 FROM registrations o WHERE o.drop_id = $3 AND o.messaging_contact_id = $1
               )`,
              [contact.messaging_contact_id, created.id, dropId],
            );
            if (linked.rowCount === 1) {
              await client.query(
                `INSERT INTO audit_logs (action, entity_type, entity_id, metadata)
                 VALUES ('INSTAGRAM_CONTACT_LINKED', 'registration', $1, '{"by":"USERNAME","via":"inheritance"}'::jsonb)`,
                [created.id],
              );
            }
          } catch (error) {
            if (
              typeof error !== "object" || error === null ||
              !("code" in error) || error.code !== "23505" ||
              !("constraint" in error) || error.constraint !== "registrations_drop_contact_uq"
            ) throw error;
            await client.query("ROLLBACK TO SAVEPOINT registration_inherit");
          }
          await client.query("RELEASE SAVEPOINT registration_inherit");
        }
        await client.query(
          `INSERT INTO audit_logs (action, entity_type, entity_id, metadata)
           VALUES ('REGISTRATION_CREATED', 'registration', $1, $2::jsonb)`,
          [created.id, JSON.stringify({ origin: "WEB", dropNumber: drop.number })],
        );

        return {
          kind: "created",
          drop,
          id: created.id,
          registrationNumber: created.registration_number,
          linkVersion: created.link_version,
          igLinkCode: created.ig_link_code,
        };
      },
    );
  },

  async findByDropAndNumber(dropNumber, registrationNumber): Promise<ExpedienteRecord | null> {
    const result = await getPool().query<ExpedienteRow>(
      `SELECT r.id, r.registration_number, r.full_name, r.size, r.piece_status, r.link_version,
              d.number AS drop_number, d.name AS drop_name, d.registered_opens_at AS drop_registered_opens_at,
              d.public_opens_at AS drop_public_opens_at, d.pieces AS drop_pieces
       FROM registrations r JOIN drops d ON d.id = r.drop_id
       WHERE d.number = $1 AND r.registration_number = $2`,
      [dropNumber, registrationNumber],
    );
    const record = result.rows[0];
    if (!record) {
      return null;
    }

    return {
      id: record.id,
      drop: {
        number: record.drop_number, name: record.drop_name,
        registeredOpensAt: record.drop_registered_opens_at,
        publicOpensAt: record.drop_public_opens_at, pieces: record.drop_pieces,
      },
      registrationNumber: record.registration_number,
      fullName: record.full_name,
      size: record.size,
      pieceStatus: record.piece_status,
      linkVersion: record.link_version,
    };
  },
};
