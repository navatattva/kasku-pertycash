# KasKu Kargo — Petty Cash & Approval Operasional

Aplikasi manajemen kas kecil (*petty cash*), kasbon operasional, tutup kas harian/bulanan, Guard Anti-Fraud, RBAC dinamis, dan Audit Trail berantai SHA-256 untuk perusahaan logistik & kargo.

---

## Persiapan Deploy di Dokploy (Dockerfile)

Repositori ini menggunakan multi-stage **Dockerfile** berbasis `node:22-bookworm-slim` agar seluruh dependensi framework (`React 19`, `Vite 8`, `Tailwind CSS v4`, `Express 4`, `TypeScript`) ter-install bersih oleh Node.js/npm dan berjalan optimal di produksi.

### 1. Ringkasan Build & Runtime Docker
- **Base Image**: `node:22-bookworm-slim` (glibc-compatible untuk native bindings Vite 8 & Tailwind v4, serta dukungan native `node server.ts` di Node 22)
- **Stage `builder`**: `npm install --no-audit --no-fund` + `npm run build`
- **Stage `runner`**: `npm install --omit=dev` + `node server.ts`
- **Port**: `3000` (atau mengikuti env `PORT`)
- **Healthcheck**: `GET /api/health` (`200 OK`)

### 2. Pengaturan di Dashboard Dokploy
1. Push kode ini ke repository Git Anda.
2. Buat **Application** baru di Dokploy -> pilih sumber repository Git Anda.
3. Pada **Build Type**, pilih **Dockerfile** (Build Path: `./Dockerfile`, Context Path: `.`).
4. Pada tab **Environment**, isi minimal variabel berikut:
   ```env
   NODE_ENV=production
   PORT=3000
   DATA_DIR=/app/data
   AUTH_JWT_SECRET=<ganti-dengan-random-string-minimal-32-karakter>
   APP_URL=https://domain-anda.com
   ```
   Opsional:
   - `ADMIN_BOOTSTRAP_PASSCODE`: kode pengaman tambahan saat setup akun Direktur pertama kali.
   - `ALLOWED_ORIGINS`: daftar domain tambahan (pisahkan dengan koma) jika diakses melalui beberapa domain.
   - `WHATSAPP_API_TOKEN`: token gateway WhatsApp sisi server jika mengaktifkan pengiriman otomatis.
5. Pada tab **Advanced -> Volumes / Mounts**, tambahkan **Volume Mount** agar database JSON, jurnal audit SHA-256, dan foto nota tidak hilang saat redeploy:
   - **Mount Path (Container)**: `/app/data`
   - (Sesuaikan dengan nilai `DATA_DIR=/app/data`).
6. Pada tab **Domains**, arahkan domain/subdomain Anda ke Container Port `3000`.
7. Klik **Deploy**.

### 3. Aktivasi Pertama Kali (First-Run Setup)
- Setelah aplikasi live, buka URL aplikasi Anda.
- Halaman akan otomatis menampilkan **Aktivasi Direktur Pertama (Setup Awal)** untuk membuat akun Super Admin pertama.
- Setelah masuk, buka menu **Role, Permission & Aksi** untuk mengatur role tim operasional, user, masa berlaku access/refresh token, dan batas rate limiter.

---

## Pengembangan Lokal

```bash
npm install
npm run dev
```

Aplikasi dev berjalan di `http://localhost:3000`.

### Pengujian & Validasi
```bash
npx --yes tsx --test src/utils/pettycashLogic.test.ts
npm run lint
npm run build
```
