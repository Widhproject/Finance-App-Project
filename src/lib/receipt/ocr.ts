export interface OcrLine { text: string; confidence: number }
export interface OcrResult { text: string; lines: OcrLine[]; confidence: number }

/**
 * Runs Tesseract.js entirely in the browser (Web Worker). The engine, WASM core and language data are
 * served from /tesseract (same origin, cached by the service worker) — nothing is sent to any server.
 * The library is imported lazily so it never affects initial load.
 */
export async function runOcr(image: Blob, onProgress: (p: number, status: string) => void): Promise<OcrResult> {
  const { createWorker } = await import('tesseract.js')
  const base = new URL(`${import.meta.env.BASE_URL}tesseract/`, window.location.href).href.replace(/\/$/, '')
  onProgress(0, 'Menyiapkan mesin OCR')
  const worker = await createWorker('eng', 1, {
    workerPath: `${base}/worker.min.js`,
    corePath: base,
    langPath: `${base}/lang`,
    gzip: true,
    logger: (m: { status: string; progress: number }) => {
      const label: Record<string, string> = {
        'loading tesseract core': 'Memuat mesin OCR', 'initializing tesseract': 'Menyiapkan mesin OCR',
        'loading language traineddata': 'Memuat data bahasa', 'initializing api': 'Menyiapkan mesin OCR', 'recognizing text': 'Membaca teks struk',
      }
      onProgress(m.progress ?? 0, label[m.status] ?? m.status)
    },
  })
  try {
    await worker.setParameters({ preserve_interword_spaces: '1', tessedit_pageseg_mode: '6' as never })
    const { data } = await worker.recognize(image, {}, { text: true, blocks: true } as never)
    const raw = (data as any).lines ?? (data as any).blocks?.flatMap((b: any) => b.paragraphs.flatMap((p: any) => p.lines)) ?? []
    const lines: OcrLine[] = raw.map((l: any) => ({ text: String(l.text).replace(/\n$/, ''), confidence: Number(l.confidence) || 0 })).filter((l: OcrLine) => l.text.trim())
    return { text: data.text ?? lines.map((l) => l.text).join('\n'), lines, confidence: data.confidence ?? 0 }
  } finally {
    await worker.terminate() // free worker + WASM memory
  }
}
