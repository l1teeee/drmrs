export async function readLimitedBody(
  request: Request,
  maximumBytes: number,
): Promise<{ ok: true; text: string; bytes: Buffer } | { ok: false }> {
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maximumBytes) {
    return { ok: false };
  }

  if (!request.body) {
    return { ok: true, text: "", bytes: Buffer.alloc(0) };
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let byteLength = 0;

  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;

    byteLength += chunk.value.byteLength;
    if (byteLength > maximumBytes) {
      await reader.cancel();
      return { ok: false };
    }
    chunks.push(chunk.value);
  }

  const bytes = Buffer.alloc(byteLength);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return { ok: true, text: new TextDecoder().decode(bytes), bytes };
}
