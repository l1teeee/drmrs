export interface ClaimedMessage {
  id: string;
  contactId: string;
  recipientId: string;
  body: string;
  partsSent: number;
  attempts: number;
  lastInboundAt: Date | null;
  lease: Date;
}

export interface MessageOutbox {
  claimDue(limit: number): Promise<ClaimedMessage[]>;
  recordPart(id: string, lease: Date, partIndex: number, externalPartId: string): Promise<boolean>;
  complete(id: string, lease: Date): Promise<boolean>;
  retry(id: string, lease: Date, delaySeconds: number, errorCode: string): Promise<boolean>;
  fail(id: string, lease: Date, errorCode: string): Promise<boolean>;
  waitForWindow(id: string, lease: Date): Promise<boolean>;
}
