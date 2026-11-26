# Matriks Skenario Negatif, Fraud & Kasus Terburuk — KasKu Kargo

Dokumen ini merangkum skenario uji *adversarial*, pencegahan kecurangan (*anti-fraud*), kegagalan batas (*negative boundary*), dan tekanan operasional terburuk (*worst-case*) yang terverifikasi otomatis pada kode aplikasi.

## Menjalankan Seluruh Skenario

```bash
npm test
```

Atau jalankan masing-masing berkas:
- **Skenario Domain & Logika**: `npx tsx --test src/utils/scenarios.test.ts`
- **Skenario Serangan API & Backend**: `npx tsx --test server/scenarios.test.ts`

---

## 1. Skenario Fraud (Kecurangan & Korupsi Petty Cash)

| ID | Nama Skenario | Modus Kecurangan | Pertahanan Sistem | Verifikasi |
|---|---|---|---|---|
| `FRAUD-01` | Pecah Nota (*Split Claim*) & Klaim Armada Sama | Memecah belanja besar menjadi beberapa klaim kecil di hari sama pada unit truk yang sama | Flag otomatis `SPLIT_TRANSACTION_SUSPECT` & `VEHICLE_SAME_DAY_CLAIM` di Guard Anti-Fraud | `src/utils/scenarios.test.ts` |
| `FRAUD-02` | *Double Billing* Nomor Nota Ganda | Mengajukan ulang nomor bukti/surat jalan yang sudah pernah dipakai (lintas pengajuan atau realisasi kasbon) | Blokir keras pada pengajuan & realisasi kasbon (normalisasi huruf besar/spasi) | `src/utils/scenarios.test.ts`, `server/scenarios.test.ts` |
| `FRAUD-03` | Kolusi *Self-Approval* | Pemohon mencoba menyetujui pengajuannya sendiri meski memegang akun approver | `checkSelfApprovalGuard` memblokir persetujuan oleh pemohon (`400`) | `src/utils/scenarios.test.ts`, `server/scenarios.test.ts` |
| `FRAUD-04` | Klaim Fiktif Tanpa Foto Nota & Melebihi Plafon | Mengajukan klaim tanpa melampirkan foto nota atau melebihi batas maksimal per transaksi | Blokir keras `MISSING_RECEIPT_IMAGE` & `OVER_SINGLE_LIMIT` di klien dan server | `src/utils/scenarios.test.ts`, `server/scenarios.test.ts` |
| `FRAUD-05` | Timbun Kasbon Ganda & Realisasi Tanpa Struk | Karyawan yang masih punya kasbon open/pending mengajukan kasbon baru lagi | `validateDownPaymentCreation` memblokir pengajuan kasbon kedua; `validateDownPaymentSettlement` mewajibkan foto struk | `src/utils/scenarios.test.ts` |
| `FRAUD-06` | Tutupi Selisih Brankas (*Cash Opname*) | Melaporkan selisih fisik kas kurang tanpa menulis berita acara/catatan penjelasan | `validateCashOpnameInput` menolak selisih ≠ Rp 0 tanpa catatan minimal 3 karakter | `src/utils/scenarios.test.ts`, `server/scenarios.test.ts` |
| `FRAUD-07` | Manipulasi Buku Audit (*Log Tampering*) | Mengubah nominal, aktor, timestamp, atau menghapus baris tengah pada log audit | Rantai hash SHA-256 (`verifyActivityLogChainSync`) langsung mendeteksi nomor urut yang rusak | `src/utils/scenarios.test.ts`, `server/scenarios.test.ts` |

---

## 2. Skenario Negatif & Serangan Keamanan

| ID | Nama Skenario | Vektor Uji / Input Negatif | Respons Sistem | Verifikasi |
|---|---|---|---|---|
| `NEG-01` | Divisi Nonaktif & Nominal Tidak Valid | Mengajukan transaksi ke divisi nonaktif, nominal `0`, negatif, desimal, `NaN`, atau `Infinity` | Ditolak sebelum mengubah saldo (`400`) | `src/utils/scenarios.test.ts` |
| `NEG-02` | Penolakan Tanpa Alasan & Re-Approve | Menolak tanpa catatan/quick-answer, atau mencoba menyetujui ulang pengajuan yang sudah ditolak | Ditolak (`terminal status locked`) | `src/utils/scenarios.test.ts` |
| `NEG-03` | Kunci Periode Saat Masih Ada Pending | Mencoba mengunci buku bulan ketika pengajuan/kasbon pending belum diputuskan | Ditolak hingga seluruh antrean bulan itu selesai | `src/utils/scenarios.test.ts`, `server/scenarios.test.ts` |
| `NEG-04` | Eskalasi Role & Penghapusan Izin Admin | Role terbatas mengakses endpoint admin/audit/approval; percobaan mencabut izin admin sistem | Server membalas `403 Forbidden`; izin inti `SYSTEM_ADMIN_LOCKED_PERMISSIONS` terkunci | `src/utils/scenarios.test.ts`, `server/scenarios.test.ts` |
| `API-NEG-01` | Akses Tanpa Token, JWT Palsu & Bootstrap Ganda | Memanggil endpoint proteksi tanpa Bearer token, JWT dengan signature palsu, atau bootstrap admin ulang | `401 Unauthorized` & blokir setup ulang | `server/scenarios.test.ts` |
| `API-SEC-01` | Serangan CSRF, Upload Berbahaya & Path Traversal | `Origin` lintas domain, upload `<script>` berkedok PNG, atau `GET /api/uploads/../../package.json` | `403 ORIGIN_FORBIDDEN`, `400` magic-byte mismatch, `404` traversal blocked | `server/scenarios.test.ts` |
| `API-SEC-03` | *Refresh Token Replay* & *Brute-Force* Login | Memakai ulang refresh token bekas rotasi; mengirim >15 percobaan password salah berturut-turut | Sesi dicabut otomatis (`401`), akun dikunci cooldown (`429`), dan limiter membalas `429` (`RATE_LIMITED`) + `Retry-After` | `server/scenarios.test.ts` |
| `NEG-CSV` | Injeksi Rumus Spreadsheet (`=CMD`, `@SUM`) | Mengisi karakter pemicu rumus di judul/catatan lalu ekspor CSV | Awalan dinetralkan dengan tanda petik tunggal (`'`) | `src/utils/scenarios.test.ts` |

---

## 3. Skenario Terburuk Operasional (*Worst-Case*)

| ID | Nama Skenario | Kondisi Ekstrem | Perilaku Sistem | Verifikasi |
|---|---|---|---|---|
| `WORST-01` | Krisis Antrean Hold (*Concurrent Overdraft*) | Pengajuan & kasbon pending mengunci >95% saldo; klaim baru masuk melebihi `availableBalance` atau kekurangan saldo saat reimburse kasbon | Seluruh potensi *overdraft* diblokir terhadap `saldo - pendingHold` | `src/utils/scenarios.test.ts`, `server/scenarios.test.ts` |
| `WORST-02` | Kolaps Likuiditas & Lonjakan Burn Rate 1.5x | Saldo mendekati Rp 0, anggaran 100% terpakai, selisih opname -Rp 1.000.000, lonjakan pengeluaran | `calculateCashHealth` berstatus `Kritis (<45)` dan `calculateCashForecast` memproyeksikan runway ≤1 hari serta top-up darurat | `src/utils/scenarios.test.ts` |
| `WORST-03` | *Cold-Start* Tanpa Histori & Nol Anggaran | Semua saldo, anggaran, dan riwayat transaksi bernilai 0 | Menghasilkan angka terbatas valid tanpa `NaN` atau *division-by-zero* | `src/utils/scenarios.test.ts` |
