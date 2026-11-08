/** Minimal RFC-4180 CSV parser/serializer (handles quotes, embedded commas/newlines, ; delimiter). */
export function parseCsv(text: string): string[][] {
  text = text.replace(/^\uFEFF/, '')
  const first = text.split(/\r?\n/, 1)[0] ?? ''
  const delim = (first.match(/;/g)?.length ?? 0) > (first.match(/,/g)?.length ?? 0) ? ';' : ','
  const rows: string[][] = []
  let row: string[] = [], cell = '', q = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (q) {
      if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++ } else q = false } else cell += ch
    } else if (ch === '"') q = true
    else if (ch === delim) { row.push(cell); cell = '' }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = '' }
    else cell += ch
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row) }
  return rows.filter((r) => r.some((c) => c.trim() !== ''))
}

const esc = (v: string | number) => { const s = String(v ?? ''); return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }
export const toCsv = (rows: (string | number)[][]) => '\uFEFF' + rows.map((r) => r.map(esc).join(',')).join('\r\n')
