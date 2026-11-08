export const MAX_IMAGE_BYTES = 15 * 1024 * 1024

function loadBitmap(file: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') return createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions)
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file); const img = new Image()
    img.onload = () => { URL.revokeObjectURL(url); res(img) }
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('Gambar tidak dapat dibaca.')) }
    img.src = url
  })
}

function toBlob(c: HTMLCanvasElement, q = 0.85): Promise<Blob> {
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('Gagal memproses gambar.'))), 'image/jpeg', q))
}

/** Downscale an image so the longest side is at most `max` px. Used for attached proof photos. */
export async function resizeImage(file: Blob, max = 1280): Promise<Blob> {
  const bmp = await loadBitmap(file)
  const w0 = 'naturalWidth' in bmp ? bmp.naturalWidth : bmp.width, h0 = 'naturalHeight' in bmp ? bmp.naturalHeight : bmp.height
  const k = Math.min(1, max / Math.max(w0, h0))
  const c = document.createElement('canvas'); c.width = Math.round(w0 * k); c.height = Math.round(h0 * k)
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height)
  if ('close' in bmp) bmp.close()
  const out = await toBlob(c); c.width = c.height = 0
  return out
}

/**
 * Prepare a receipt photo for OCR using the Canvas API:
 * 1) downscale (bounded memory), 2) grayscale, 3) percentile contrast stretch, 4) light sharpening.
 */
export async function preprocessForOcr(file: Blob, max = 1800): Promise<Blob> {
  if (!file.type.startsWith('image/')) throw new Error('File harus berupa gambar.')
  if (file.size > MAX_IMAGE_BYTES) throw new Error('Ukuran gambar maksimal 15 MB.')
  const bmp = await loadBitmap(file)
  const w0 = 'naturalWidth' in bmp ? bmp.naturalWidth : bmp.width, h0 = 'naturalHeight' in bmp ? bmp.naturalHeight : bmp.height
  // Receipts are tall and narrow; upscale small photos slightly so characters are ≥ ~20px.
  const k = Math.min(max / Math.max(w0, h0), Math.max(1, 1000 / Math.min(w0, h0)))
  const w = Math.round(w0 * k), h = Math.round(h0 * k)
  const c = document.createElement('canvas'); c.width = w; c.height = h
  const ctx = c.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(bmp, 0, 0, w, h)
  if ('close' in bmp) bmp.close()

  const img = ctx.getImageData(0, 0, w, h), d = img.data
  const hist = new Uint32Array(256)
  for (let i = 0; i < d.length; i += 4) { const g = (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) | 0; d[i] = d[i + 1] = d[i + 2] = g; hist[g]++ }
  const total = w * h; let acc = 0, lo = 0, hi = 255
  for (let i = 0; i < 256; i++) { acc += hist[i]; if (acc >= total * 0.01) { lo = i; break } }
  acc = 0
  for (let i = 255; i >= 0; i--) { acc += hist[i]; if (acc >= total * 0.01) { hi = i; break } }
  const span = Math.max(1, hi - lo)
  for (let i = 0; i < d.length; i += 4) { const v = Math.max(0, Math.min(255, ((d[i] - lo) * 255) / span)); d[i] = d[i + 1] = d[i + 2] = v }
  ctx.putImageData(img, 0, 0)
  const out = await toBlob(c, 0.92)
  c.width = c.height = 0 // release canvas memory
  return out
}
