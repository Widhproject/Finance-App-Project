import { Banknote, BookOpen, Briefcase, Car, Dumbbell, Gift, Home, Laptop, Plane, Receipt, ShieldCheck, ShoppingCart, Sparkles, Stethoscope, TrendingUp, Tv, Utensils, Wallet, Target, Music, Repeat, HeartPulse, type LucideIcon } from 'lucide-react'

const MAP: [RegExp, LucideIcon][] = [
  [/makan|minum|kopi|resto|food/i, Utensils], [/transport|bensin|ojek|parkir/i, Car], [/belanja|shop|market/i, ShoppingCart],
  [/hibur|film|game/i, Tv], [/pendidikan|sekolah|kuliah|buku/i, BookOpen], [/kesehatan|obat|dokter/i, Stethoscope],
  [/tagihan|listrik|internet|bill/i, Receipt], [/kos|tinggal|rumah|sewa/i, Home], [/gym|fitness|olahraga/i, Dumbbell],
  [/langganan|subscription|spotify|netflix/i, Repeat], [/pribadi|personal|salon/i, Sparkles],
  [/gaji|salary/i, Banknote], [/uang saku|saku/i, Wallet], [/freelance|kerja/i, Laptop], [/bisnis|usaha/i, Briefcase],
  [/investasi|saham|reksa/i, TrendingUp], [/hadiah|gift/i, Gift],
  [/liburan|travel|jepang|trip|wisata/i, Plane], [/darurat|emergency/i, ShieldCheck], [/laptop|gadget|hp\b/i, Laptop],
  [/mobil|motor|kendaraan/i, Car], [/musik|konser/i, Music], [/sehat/i, HeartPulse],
]
export function iconFor(name?: string): LucideIcon {
  if (!name) return Target
  return MAP.find(([rx]) => rx.test(name))?.[1] ?? Wallet
}
