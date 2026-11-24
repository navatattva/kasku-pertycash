# KasKu Kargo — Petty Cash & Approval Operasional

Aplikasi manajemen kas kecil (*petty cash*), kasbon operasional, tutup kas harian/bulanan, Guard Anti-Fraud, RBAC dinamis, dan Audit Trail berantai SHA-256 untuk perusahaan logistik & kargo.

---

## Persiapan Deploy di Dokploy (Nixpacks)

Repositori ini sudah dikonfigurasi dengan `nixpacks.toml` agar langsung siap build & jalan di **Dokploy (Nixpacks)** setelah di-push ke Git.

### 1. Ringkasan Konfigurasi Nixpacks (`nixpacks.toml`)
- **Runtime**: Node.js 22 (`nodejs_22`, mendukung eksekusi native `node server.ts`)
- **Install**: `npm install --no-audit --no-fund --include=dev`
- **Build**: `npm run build` (menghasilkan frontend SPA ke `dist/`)
- **Start**: `NODE_ENV=production node server.ts`
- **Port**: `3000` (atau mengikuti `PORT` dari Dokploy)
- **Healthcheck**: `GET /api/health` (`200 OK`)

### 2. Pengaturan di Dashboard Dokploy
1. Buat **Application** baru di Dokploy dan hubungkan ke repository Git Anda.
2. Pada **Build Type**, pilih **Nixpacks** (otomatis membaca `nixpacks.toml`).
3. Pada tab **Environment**, tambahkan minimal variabel berikut:
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
4. Pada tab **Advanced -> Volumes / Mounts**, tambahkan **Volume Mount** agar database JSON, jurnal audit SHA-256, dan foto nota tidak hilang saat redeploy:
   - **Mount Path (Container)**: `/app/data`
   - (Sesuaikan dengan nilai `DATA_DIR=/app/data`).
5. Pada tab **Domains**, arahkan domain/subdomain Anda ke Container Port `3000`.
6. Klik **Deploy**.

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
