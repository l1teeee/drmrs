"use client";

const decodeError = "No se pudo leer la imagen. Usa una foto JPG, PNG o WebP.";

function canvasBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

const MAX_BYTES = 1_048_576;

async function encode(
  bitmap: ImageBitmap,
  maxSide: number,
  webpQuality: number,
  jpegQuality: number,
): Promise<Blob> {
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error(decodeError);
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

  const webp = await canvasBlob(canvas, "image/webp", webpQuality);
  if (webp?.type === "image/webp") return webp;
  const jpeg = await canvasBlob(canvas, "image/jpeg", jpegQuality);
  if (!jpeg) throw new Error(decodeError);
  return jpeg;
}

export async function prepararImagen(file: File): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error(decodeError);
  }

  try {
    const attempts = [
      { maxSide: 1600, webpQuality: 0.82, jpegQuality: 0.85 },
      { maxSide: 1600, webpQuality: 0.7, jpegQuality: 0.7 },
      { maxSide: 1280, webpQuality: 0.7, jpegQuality: 0.7 },
    ];
    for (const { maxSide, webpQuality, jpegQuality } of attempts) {
      const blob = await encode(bitmap, maxSide, webpQuality, jpegQuality);
      if (blob.size <= MAX_BYTES) return blob;
    }
    throw new Error("La foto pesa más de 1 MB incluso reducida.");
  } finally {
    bitmap.close();
  }
}
