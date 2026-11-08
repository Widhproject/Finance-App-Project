# Personal Finance Manager

Aplikasi pencatat keuangan pribadi, local-first. React + TypeScript + Vite + Tailwind, Recharts, Lucide, IndexedDB, Tesseract.js.
Desain mengikuti `linear.app/DESIGN.md` (token warna, tipografi, radius, spasi, komponen).

## Menjalankan
```bash
npm install
npm run dev        # http://localhost:5173
npm test           # 28 tes: perhitungan saldo, transfer, parser struk, backup/restore, CSV
npm run build      # tsc + vite build → dist/
```
`npm run dev/build` otomatis menyalin mesin OCR ke `public/tesseract/` (worker, WASM, data bahasa) agar OCR berjalan offline tanpa CDN.

## Deploy ke Netlify
Hubungkan repo; `netlify.toml` sudah berisi build command, publish dir `dist`, dan redirect SPA. Tidak ada Netlify Function, tidak ada backend.

## Struktur
```
src/lib/        money (integer, tanpa float), calc (saldo diturunkan dari transaksi), db (IndexedDB), crypto (PBKDF2),
                recurring, insights, export, importCsv, backup, image (Canvas), receipt/{parser,category,ocr}
src/store/      AppStore: satu jalur tulis data + validasi + peringatan anggaran
src/components/ UI primitif, PinGate/PinPad, TransactionForm, charts, layout/Shell
src/pages/      Dashboard, Transactions, Accounts, Budgets, Goals, Analysis, CalendarPage, RecurringPage, Notes, Scan, SettingsPage
```

## Keputusan penting
- **Saldo tidak disimpan**, selalu dihitung: Saldo Awal + Pemasukan − Pengeluaran + Transfer Masuk − Transfer Keluar. Edit/hapus otomatis benar; transfer tidak pernah dihitung sebagai pemasukan/pengeluaran.
- **Uang = integer** (rupiah, atau sen untuk USD dll). Konversi kurs hanya untuk total/laporan.
- **PIN**: PBKDF2-SHA256 (210.000 iterasi) + salt acak; kunci sementara setelah 5 kali salah; auto-lock. PIN **tidak** disertakan dalam file backup.
- **Transaksi berulang** tidak pernah dicatat diam-diam: muncul sebagai "jatuh tempo" dan harus dikonfirmasi. ID transaksi diturunkan dari (jadwal, tanggal) sehingga tidak bisa ganda.
- **Struk**: semua proses di browser (Web Worker), pustaka dimuat lazy, gambar tidak disimpan kecuali dicentang. Total yang ambigu tidak dipilih otomatis. Struk yang sama (merchant+tanggal+jam+total+jumlah item) ditolak.

## Batasan yang perlu diketahui
- Data di IndexedDB **tidak dienkripsi**; PIN mengunci tampilan aplikasi. Lakukan backup rutin.
- Pengingat hanya berjalan saat aplikasi terbuka (tanpa server tidak ada push di latar).
- Dana "Target Tabungan" dicatat terpisah dan tidak memotong saldo akun.
- OCR memakai data bahasa Inggris; akurasi bergantung kualitas foto. Hasil selalu perlu diperiksa.
