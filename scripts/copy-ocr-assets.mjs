// Copies the OCR worker, WASM core and English language data into /public/tesseract
// so the scanner runs fully offline and never contacts a CDN.
import { cpSync, mkdirSync, existsSync, readdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const out = resolve(root, 'public/tesseract')
mkdirSync(resolve(out, 'lang'), { recursive: true })

const nm = resolve(root, 'node_modules')
const coreDir = [resolve(nm, 'tesseract.js/node_modules/tesseract.js-core'), resolve(nm, 'tesseract.js-core')].find(existsSync)
if (!coreDir) throw new Error('tesseract.js-core not found')

cpSync(resolve(nm, 'tesseract.js/dist/worker.min.js'), resolve(out, 'worker.min.js'))
// Only the LSTM builds are needed (SIMD is chosen automatically when supported).
for (const f of readdirSync(coreDir)) {
  if (/^tesseract-core(-simd)?-lstm\.wasm\.js$/.test(f)) cpSync(resolve(coreDir, f), resolve(out, f))
}
cpSync(resolve(nm, '@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz'), resolve(out, 'lang/eng.traineddata.gz'))
console.log('OCR assets ready in public/tesseract')
