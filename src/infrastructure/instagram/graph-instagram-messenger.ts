import { type InstagramMessenger, MessengerError } from "@/application/messaging/instagram-messenger";

const TIMEOUT_MS = 8_000;

interface MetaErrorBody {
  error?: { code?: unknown; error_subcode?: unknown };
}

function numericField(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}

async function responseBody(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function asMessengerError(response: Response, body: unknown): MessengerError {
  const error = body && typeof body === "object" ? (body as MetaErrorBody).error : undefined;
  return new MessengerError("Instagram request failed", {
    status: response.status,
    code: numericField(error?.code),
    subcode: numericField(error?.error_subcode),
  });
}

export class GraphInstagramMessenger implements InstagramMessenger {
  constructor(
    private readonly options: { baseUrl: string; accountId: string; accessToken: string },
    private readonly request: typeof fetch = fetch,
  ) {}

  private async metaRequest(url: string, init: RequestInit): Promise<unknown> {
    let response: Response;
    try {
      response = await this.request(url, {
        ...init,
        signal: AbortSignal.timeout(TIMEOUT_MS),
        cache: "no-store",
      });
    } catch (error) {
      throw new MessengerError(
        "Instagram network request failed",
        { status: null },
        { cause: error },
      );
    }
    const body = await responseBody(response);
    if (!response.ok) throw asMessengerError(response, body);
    return body;
  }

  async sendText(recipientId: string, text: string): Promise<{ messageId: string }> {
    const body = await this.metaRequest(
      `${this.options.baseUrl}/${this.options.accountId}/messages`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${this.options.accessToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ recipient: { id: recipientId }, message: { text } }),
      },
    );
    const messageId =
      body &&
      typeof body === "object" &&
      typeof (body as { message_id?: unknown }).message_id === "string"
        ? (body as { message_id: string }).message_id
        : null;
    if (!messageId) {
      throw new MessengerError("Instagram response did not include a message id", { status: 200 });
    }
    return { messageId };
  }

  async fetchProfile(recipientId: string): Promise<{ username: string | null; name: string | null }> {
    const body = await this.metaRequest(
      `${this.options.baseUrl}/${recipientId}?fields=username,name`,
      { headers: { authorization: `Bearer ${this.options.accessToken}` } },
    );
    const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
    return {
      username: typeof record.username === "string" ? record.username : null,
      name: typeof record.name === "string" ? record.name : null,
    };
  }
}
