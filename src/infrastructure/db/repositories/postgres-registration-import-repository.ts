import type { Pool } from "pg";

import type {
  ImportSummary,
  RegistrationImportStore,
  RowClassification,
} from "@/application/registration-import/registration-import-store";
import type { ParsedImportRow } from "@/domain/registration-import/import-rows";

import { generateLinkCode } from "../../crypto/link-code-generator";
import { protectRegistrationContact, whatsappHashFor } from "../../registration/registration-pii";
import { getPool } from "../client";
import { inTransaction } from "../transaction";
import { REGISTRATION_NUMBER_LOCK } from "./postgres-registration-repository";

interface ExistingRegistrationRow {
  whatsapp_hash: string;
  instagram_handle: string;
  registration_number: number;
}

async function classifyRows(
  target: Pick<Pool, "query">,
  rows: ParsedImportRow[],
): Promise<RowClassification[]> {
  const hashes = rows.map((row) => whatsappHashFor(row.whatsappDigits));
  const result = await target.query<ExistingRegistrationRow>(
    `SELECT whatsapp_hash, instagram_handle, registration_number FROM registrations
     WHERE whatsapp_hash = ANY($1) OR instagram_handle = ANY($2) OR registration_number = ANY($3)`,
    [
      hashes,
      rows.map((row) => row.instagramHandle),
      rows.filter((row) => row.registrationNumber !== null).map((row) => row.registrationNumber),
    ],
  );
  const whatsapps = new Map(result.rows.map((row) => [row.whatsapp_hash, row.registration_number]));
  const instagrams = new Set(result.rows.map((row) => row.instagram_handle));
  const numbers = new Set(result.rows.map((row) => row.registration_number));

  return rows.map((row, index) => {
    const existingNumber = whatsapps.get(hashes[index]);
    if (existingNumber !== undefined) {
      return { line: row.line, status: "existing", registrationNumber: existingNumber };
    }
    if (instagrams.has(row.instagramHandle)) {
      return {
        line: row.line, status: "conflict", reason: "instagram ya registrado",
        registrationNumber: row.registrationNumber,
      };
    }
    if (row.registrationNumber !== null && numbers.has(row.registrationNumber)) {
      return {
        line: row.line, status: "conflict", reason: "número ocupado",
        registrationNumber: row.registrationNumber,
      };
    }
    return { line: row.line, status: "new", registrationNumber: row.registrationNumber };
  });
}

export const postgresRegistrationImportRepository: RegistrationImportStore = {
  classify(rows): Promise<RowClassification[]> {
    return classifyRows(getPool(), rows);
  },

  insertNew(adminId, rows): Promise<ImportSummary> {
    return inTransaction(
      getPool(),
      ["SET LOCAL lock_timeout = '5s'", "SET LOCAL statement_timeout = '15s'"],
      async (client) => {
        await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [REGISTRATION_NUMBER_LOCK]);
        const classified = await classifyRows(client, rows);
        const newLines = new Set<number>();
        const summary: ImportSummary = { created: 0, existing: 0, conflicts: 0 };
        for (const row of classified) {
          if (row.status === "new") newLines.add(row.line);
          else if (row.status === "existing") summary.existing += 1;
          else summary.conflicts += 1;
        }

        const newRows = rows.filter((row) => newLines.has(row.line));
        if (newRows.length > 0) {
          const current = await client.query<{ maximum: number; now: Date }>(
            "SELECT COALESCE(MAX(registration_number), 0) AS maximum, now() AS now FROM registrations",
          );
          let maximum = current.rows[0]!.maximum;
          const now = current.rows[0]!.now;
          for (const row of newRows) {
            if (row.registrationNumber !== null) maximum = Math.max(maximum, row.registrationNumber);
          }

          const numbered = newRows.filter((row) => row.registrationNumber !== null);
          const unnumbered = newRows.filter((row) => row.registrationNumber === null);
          unnumbered.sort((left, right) => {
            if (left.registeredAt === null && right.registeredAt !== null) return 1;
            if (left.registeredAt !== null && right.registeredAt === null) return -1;
            const dateOrder = left.registeredAt !== null && right.registeredAt !== null
              ? left.registeredAt.getTime() - right.registeredAt.getTime()
              : 0;
            return dateOrder || left.line - right.line;
          });
          const assigned = unnumbered.map((row) => {
            maximum += 1;
            if (maximum > 9999) throw new Error("registration numbers exhausted");
            return { ...row, registrationNumber: maximum };
          });
          const protectedRows = [...numbered, ...assigned].map((row) => ({
            ...row,
            ...protectRegistrationContact(row.whatsappDigits, row.email),
            registeredAt: row.registeredAt ?? now,
          }));

          let insertedIds: string[];
          for (let attempt = 0; ; attempt += 1) {
            await client.query("SAVEPOINT registration_link_code");
            try {
              const inserted = await client.query<{ id: string }>(
                `INSERT INTO registrations (
                   registration_number, full_name, instagram_handle,
                   whatsapp_ciphertext, whatsapp_hash, email_ciphertext,
                   size, archive_nominee, source, origin, registered_at, privacy_accepted_at, ig_link_code
                 )
                 SELECT * FROM unnest(
                   $1::int[], $2::text[], $3::text[], $4::text[], $5::text[], $6::text[],
                   $7::text[], $8::text[], $9::text[], $10::text[],
                   $11::timestamptz[], $11::timestamptz[], $12::text[]
                 )
                 RETURNING id`,
                [
                  protectedRows.map((row) => row.registrationNumber),
                  protectedRows.map((row) => row.fullName),
                  protectedRows.map((row) => row.instagramHandle),
                  protectedRows.map((row) => row.whatsappCiphertext),
                  protectedRows.map((row) => row.whatsappHash),
                  protectedRows.map((row) => row.emailCiphertext),
                  protectedRows.map((row) => row.size),
                  protectedRows.map((row) => row.archiveNominee),
                  protectedRows.map((row) => row.source),
                  protectedRows.map(() => "IMPORT"),
                  protectedRows.map((row) => row.registeredAt),
                  protectedRows.map(() => generateLinkCode()),
                ],
              );
              await client.query("RELEASE SAVEPOINT registration_link_code");
              insertedIds = inserted.rows.map((row) => row.id);
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
          summary.created = insertedIds.length;
          await client.query(
            `INSERT INTO audit_logs (actor_admin_id, action, entity_type, entity_id, metadata)
             SELECT $1::uuid, 'REGISTRATION_CREATED', 'registration', id, '{"origin":"IMPORT"}'::jsonb
             FROM unnest($2::text[]) AS created(id)`,
            [adminId, insertedIds],
          );
        }

        await client.query(
          `INSERT INTO audit_logs (actor_admin_id, action, entity_type, entity_id, metadata)
           VALUES ($1, 'REGISTRATIONS_IMPORTED', 'registration', NULL, $2::jsonb)`,
          [adminId, JSON.stringify(summary)],
        );
        return summary;
      },
    );
  },
};
