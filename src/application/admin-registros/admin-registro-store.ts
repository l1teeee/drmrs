import type { ListFilters } from "@/contracts/admin-registros";
import type { TemplateKey } from "@/domain/messaging/message-template";
import type { PieceStatus, Size } from "@/domain/registration/registration";

export type AdminRegistroRow = {
  dropId: string;
  dropNumber: number;
  dropName: string;
  dropRegisteredOpensAt: Date;
  dropPublicOpensAt: Date;
  id: string;
  registrationNumber: number;
  fullName: string;
  instagramHandle: string;
  whatsappDigits: string;
  email: string | null;
  size: Size;
  archiveNominee: string | null;
  source: string;
  origin: "WEB" | "IMPORT";
  pieceStatus: PieceStatus;
  linkVersion: number;
  registeredAt: Date;
};

export type MessageTemplate = { key: TemplateKey; body: string; updatedAt: Date };

export type AuditEntry = {
  id: number;
  occurredAt: Date;
  actorName: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: Record<string, unknown>;
  registro: { id: string; numero: number; nombre: string; instagram: string; dropNumber: number } | null;
};

export interface AdminRegistroStore {
  list(filters: ListFilters): Promise<AdminRegistroRow[]>;
  findById(id: string): Promise<AdminRegistroRow | null>;
  changeStatus(
    adminId: string,
    id: string,
    expected: PieceStatus,
    next: PieceStatus,
  ): Promise<"changed" | "conflict" | "not_found">;
  regenerateLink(adminId: string, id: string): Promise<{ linkVersion: number } | null>;
  listTemplates(): Promise<MessageTemplate[]>;
  updateTemplate(adminId: string, key: TemplateKey, body: string): Promise<void>;
  recordExport(adminId: string, count: number, dropNumber: number | null): Promise<void>;
  listAudit(offset: number, limit: number): Promise<AuditEntry[]>;
  countAudit(): Promise<number>;
}
