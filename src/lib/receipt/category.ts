/** Maps merchant / item text to a built-in expense category id. The user can always change it. */
const RULES: [RegExp, string][] = [
  [/indomaret|alfamart|alfamidi|alfa\s*express|superindo|super\s*indo|hypermart|giant|transmart|carrefour|lotte\s*mart|farmers\s*market|ranch\s*market|lawson|circle\s*k|familymart|yogya|ace\s*hardware|informa|miniso|ikea|mitra\s*10|toserba|minimarket|supermarket/i, 'exp-belanja'],
  [/pertamina|spbu|shell|\bbp\b|vivo\s*energy|bensin|pertalite|pertamax|solar\b|parkir|\btol\b|grab|gojek|gocar|blue\s*bird|transjakarta|\bkrl\b|\bmrt\b|\blrt\b|kereta|tiket\s*bus/i, 'exp-transport'],
  [/apotek|apotik|kimia\s*farma|guardian|century|k-?24|farmasi|klinik|rumah\s*sakit|\brs\b|dokter|laborat|halodoc|obat/i, 'exp-kesehatan'],
  [/kfc|mcd|mcdonald|burger\s*king|pizza|starbucks|kopi|coffee|cafe|kafe|resto|restoran|warung|warteg|bakso|\bmie\b|nasi|sate|bakery|roti|dunkin|j\.?co|chatime|janji\s*jiwa|\bfore\b|tomoro|solaria|hoka|yoshinoya|geprek|ayam|seafood|padang|food|kitchen|steak|sushi|boba|es\s*teh|catering/i, 'exp-makan'],
  [/pln|listrik|telkom|indihome|pdam|bpjs|pulsa|telkomsel|indosat|smartfren|first\s*media|tagihan/i, 'exp-tagihan'],
  [/bioskop|cinema|xxi|cgv|steam|playstation|game|karaoke|timezone/i, 'exp-hiburan'],
  [/gramedia|toko\s*buku|kursus|sekolah|kampus|universitas|buku|alat\s*tulis/i, 'exp-pendidikan'],
  [/gym|fitness|yoga|anytime/i, 'exp-gym'],
  [/salon|barber|watsons|sociolla|kosmetik|skincare/i, 'exp-pribadi'],
]

export function suggestCategoryId(merchant: string, itemNames: string[] = []): string | undefined {
  for (const [rx, id] of RULES) if (rx.test(merchant)) return id
  const blob = itemNames.join(' ')
  for (const [rx, id] of RULES) if (blob && rx.test(blob)) return id
  return undefined
}
