import type { Pool } from "pg";

import type {
  ImportSummary,
  RegistrationImportStore,
  RowClassification,
} from "@/application/registration-import/registration-import-store";
import type { ParsedImportRow } from "@/domain/registration-import/import-rows";
import { registrationNumberLockKey } from "@/application/registration/registration-store";

import { generateLinkCode } from "../../crypto/link-code-generator";
import { protectRegistrationContact, whatsappHashFor } from "../../registration/registration-pii";
import { getPool } from "../client";
import { inTransaction } from "../transaction";

interface ExistingRegistrationRow {
  whatsapp_hash: string;
  instagram_handle: string;
  registration_number: number;
}

async function classifyRows(
  target: Pick<Pool, "query">,
  rows: ParsedImportRow[],
  dropId: string,
): Promise<RowClassification[]> {
  const hashes = rows.map((row) => whatsappHashFor(row.whatsappDigits));
  const result = await target.query<ExistingRegistrationRow>(
    `SELECT whatsapp_hash, instagram_handle, registration_number FROM registrations
     WHERE drop_id = $4 AND (whatsapp_hash = ANY($1) OR instagram_handle = ANY($2) OR registration_number = ANY($3))`,
    [
      hashes,
      rows.map((row) => row.instagramHandle),
      rows.filter((row) => row.registrationNumber !== null).map((row) => row.registrationNumber),
      dropId,
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
  classify(rows, dropId): Promise<RowClassification[]> {
    return classifyRows(getPool(), rows, dropId);
  },

  insertNew(adminId, rows, dropId): Promise<ImportSummary | { kind: "not_found" }> {
    return inTransaction<ImportSummary | { kind: "not_found" }>(
      getPool(),
      ["SET LOCAL lock_timeout = '5s'", "SET LOCAL statement_timeout = '15s'"],
      async (client) => {
        const drops = await client.query<{ id: string; number: number }>(
          "SELECT id, number FROM drops WHERE id = $1 FOR SHARE", [dropId],
        );
        const drop = drops.rows[0];
        if (!drop) return { kind: "not_found" };
        await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [registrationNumberLockKey(dropId)]);
        const classified = await classifyRows(client, rows, dropId);
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
            "SELECT COALESCE(MAX(registration_number), 0) AS maximum, now() AS now FROM registrations WHERE drop_id = $1",
            [dropId],
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
                   size, archive_nominee, source, origin, registered_at, privacy_accepted_at, ig_link_code, drop_id
                 )
                 SELECT * FROM unnest(
                   $1::int[], $2::text[], $3::text[], $4::text[], $5::text[], $6::text[],
                   $7::text[], $8::text[], $9::text[], $10::text[],
                   $11::timestamptz[], $11::timestamptz[], $12::text[], $13::uuid[]
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
                  protectedRows.map(() => dropId),
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
          await client.query("SAVEPOINT import_inherit");
          try {
            await client.query(
              `SELECT mc.id FROM messaging_contacts mc WHERE mc.id IN (
                 SELECT p.messaging_contact_id FROM registrations n
                 JOIN registrations p ON p.instagram_handle = n.instagram_handle
                   AND p.whatsapp_hash = n.whatsapp_hash AND p.drop_id <> n.drop_id
                   AND p.messaging_contact_id IS NOT NULL
                 WHERE n.id = ANY($1::uuid[])
               ) ORDER BY mc.id FOR UPDATE`,
              [insertedIds],
            );
            const inherited = await client.query<{ id: string }>(
              `UPDATE registrations r SET messaging_contact_id = pick.contact_id, contact_linked_by = 'USERNAME', updated_at = now()
               FROM (
                 SELECT DISTINCT ON (prev.contact_id) n.id AS new_id, prev.contact_id
                 FROM registrations n
                 JOIN LATERAL (
                   SELECT p.messaging_contact_id AS contact_id FROM registrations p JOIN drops pd ON pd.id = p.drop_id
                   WHERE p.instagram_handle = n.instagram_handle AND p.whatsapp_hash = n.whatsapp_hash
                     AND p.drop_id <> n.drop_id AND p.messaging_contact_id IS NOT NULL
                   ORDER BY pd.number DESC LIMIT 1
                 ) prev ON true
                 WHERE n.id = ANY($1::uuid[])
                 ORDER BY prev.contact_id, n.registration_number
               ) pick
               WHERE r.id = pick.new_id
                 AND NOT EXISTS (SELECT 1 FROM registrations o WHERE o.drop_id = r.drop_id AND o.messaging_contact_id = pick.contact_id)
               RETURNING r.id`,
              [insertedIds],
            );
            for (const linked of inherited.rows) {
              await client.query(
                `INSERT INTO audit_logs (actor_admin_id, action, entity_type, entity_id, metadata)
                 VALUES ($1, 'INSTAGRAM_CONTACT_LINKED', 'registration', $2, $3::jsonb)`,
                [adminId, linked.id, JSON.stringify({ by: "USERNAME", via: "inheritance", dropNumber: drop.number })],
              );
            }
          } catch (error) {
            if (
              typeof error !== "object" || error === null ||
              !("code" in error) || error.code !== "23505" ||
              !("constraint" in error) || error.constraint !== "registrations_drop_contact_uq"
            ) throw error;
            await client.query("ROLLBACK TO SAVEPOINT import_inherit");
          }
          await client.query("RELEASE SAVEPOINT import_inherit");
          await client.query(
            `INSERT INTO audit_logs (actor_admin_id, action, entity_type, entity_id, metadata)
             SELECT $1::uuid, 'REGISTRATION_CREATED', 'registration', id, $3::jsonb
             FROM unnest($2::text[]) AS created(id)`,
            [adminId, insertedIds, JSON.stringify({ origin: "IMPORT", dropNumber: drop.number })],
          );
        }

        await client.query(
          `INSERT INTO audit_logs (actor_admin_id, action, entity_type, entity_id, metadata)
           VALUES ($1, 'REGISTRATIONS_IMPORTED', 'registration', NULL, $2::jsonb)`,
          [adminId, JSON.stringify({ ...summary, dropNumber: drop.number })],
        );
        return summary;
      },
    );
  },
};
