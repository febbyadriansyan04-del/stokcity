# StayStock – Inventaris Hotel (Phase 1)

React 18 + Vite + Tailwind CSS 4 + Supabase (Postgres, Auth, RLS).

## Setup
1. Buat project gratis di https://supabase.com.
2. Buka **SQL Editor**, tempel isi `supabase/migrations/001_schema.sql`, lalu **Run**.
3. Salin `.env.example` menjadi `.env`, isi `VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY` (Project Settings → API).
4. `npm install` lalu `npm run dev`.
5. Daftar akun lewat halaman login, lalu jadikan akun pertama sebagai admin (SQL Editor):
   `update profiles set role = 'admin' where id = (select id from auth.users where email = 'email-anda@contoh.com');`
   Peran lain: `gm`, `purchasing`, `storekeeper`, `dept_head`, `dept_staff`, `finance`. Atur lewat `update profiles set role = '...', department = '...'`.
6. Saldo awal: login sebagai admin/storekeeper → menu Pergerakan → Stok masuk (referensi mis. "OPENING").

## Deploy gratis
`npm run build`, lalu unggah folder `dist` ke Cloudflare Pages / Netlify, atau hubungkan repo ke Vercel. Isi dua variabel `VITE_...` di pengaturan hosting. File `public/_redirects` sudah menangani routing SPA.
Kunci anon aman berada di browser karena akses dikendalikan RLS dan fungsi RPC. Jangan pernah memakai service_role key di frontend.

## Arsitektur
- Saldo stok = hasil akumulasi `stock_ledger` (append-only, tidak bisa diubah/dihapus). Semua perubahan lewat fungsi `_post` (cek stok negatif, moving average, idempotency key).
- Aturan bisnis ada di database (RPC): approval berjenjang berdasarkan nominal (`settings`), pembuat tidak bisa menyetujui sendiri, GRN parsial, otorisasi per peran.
- Audit trail otomatis lewat trigger (`audit_log`, hanya terbaca admin/GM/finance).

## Belum ada (lanjutan Phase 1 → 2)
Stock opname, status In Transit pada transfer (saat ini langsung selesai), alur requisition departemen sebelum stok keluar, quotation, invoice matching, notifikasi, scan QR kamera, laporan valuasi, halaman audit & administrasi; lalu modul linen, F&B, dan engineering.
