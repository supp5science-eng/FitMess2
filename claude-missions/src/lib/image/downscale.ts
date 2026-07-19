// Client-side image downscale + re-encode before uploading a photo to the
// vision API -- faster upload, lower cost, well within Gemini's needs. Falls
// back to the original file if the canvas path fails for any reason. Browser-
// only (uses createImageBitmap / canvas); only ever called from client code.

export async function downscaleImage(
  file: File,
  maxDim = 1280,
  quality = 0.82
): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);
    return await new Promise<Blob>((resolve) =>
      canvas.toBlob((blob) => resolve(blob ?? file), "image/jpeg", quality)
    );
  } catch {
    return file;
  }
}
