import type { NavTab } from '../components/Sidebar.tsx';

export type WikiCategoryId = 'core' | 'control' | 'modules' | 'admin';

export type OptionalModuleKey =
  | 'fraudGuard'
  | 'forecastModule'
  | 'taxModule'
  | 'whatsappModule';

export interface WikiCategoryMeta {
  id: WikiCategoryId;
  label: string;
}

export interface WikiArticle {
  id: string;
  order: number;
  title: string;
  shortTitle: string;
  category: WikiCategoryId;
  categoryLabel: string;
  targetTab: NavTab;
  optionalModuleKey?: OptionalModuleKey;
  summary: string;
  keyCapabilities: string[];
  workflowSteps: string[];
  rulesAndGuards: string[];
  keywords: string[];
}

export const WIKI_CATEGORIES: WikiCategoryMeta[] = [
  { id: 'core', label: 'Operasional Harian' },
  { id: 'control', label: 'Kontrol & Audit Kas' },
  { id: 'modules', label: 'Modul Opsional' },
  { id: 'admin', label: 'Master & Keamanan' },
];

export const WIKI_ARTICLES: WikiArticle[] = [
  {
    id: 'dashboard',
    order: 1,
    title: 'Dashboard Real-Time & Kesehatan Kas',
    shortTitle: 'Dashboard',
    category: 'core',
    categoryLabel: 'Operasional Harian',
    targetTab: 'dashboard',
    summary:
      'Ringkasan kondisi likuiditas petty cash seluruh divisi secara real-time, lengkap dengan skor Cash Health, pengajuan menunggu persetujuan, dan pemantauan kasbon terbuka.',
    keyCapabilities: [
      'Menampilkan total saldo kas fisik, dana tertahan (pending + kasbon aktif), dan saldo efektif yang siap dicairkan.',
      'Menghitung skor Cash Health (Sehat, Waspada, Kritis) beserta penyebab utama penurunan skor.',
      'Menyediakan pintasan cepat untuk pengajuan klaim baru, top-up saldo divisi, dan peninjauan struk.',
    ],
    workflowSteps: [
      'Buka menu Dashboard untuk memeriksa saldo tersedia dan divisi yang mendekati batas minimum.',
      'Tinjau daftar pengajuan terbaru atau alert saldo kritis di panel ringkasan.',
      'Klik tombol Ajukan Pengeluaran Baru apabila ada klaim biaya operasional baru.',
    ],
    rulesAndGuards: [
      'Saldo efektif dihitung dengan mengurangkan dana tertahan pengajuan pending dan kasbon aktif agar mencegah overdraft.',
      'Divisi di bawah ambang minimum (lowBalanceThreshold) otomatis ditandai untuk segera dilakukan top-up.',
    ],
    keywords: ['dashboard', 'saldo', 'likuiditas', 'cash health', 'real-time'],
  },
  {
    id: 'approvals',
    order: 2,
    title: 'Approval Direktur & Antrean Persetujuan',
    shortTitle: 'Approval Direktur',
    category: 'core',
    categoryLabel: 'Operasional Harian',
    targetTab: 'approvals',
    summary:
      'Pusat persetujuan pengajuan pengeluaran petty cash oleh Direktur/Approver dengan pemeriksaan anti-fraud otomatis, pratinjau struk terproteksi, dan alasan cepat terstandar.',
    keyCapabilities: [
      'Menampilkan antrean pengajuan berstatus Menunggu Approval beserta indikator risiko fraud dan nominal bersih.',
      'Mendukung keputusan Setujui atau Tolak dengan pilihan jawaban cepat terstruktur maupun catatan khusus.',
      'Memblokir self-approval antara pemohon dan penyetuju secara otomatis.',
    ],
    workflowSteps: [
      'Pilih pengajuan pada tab Menunggu Approval dan periksa foto struk serta nomor referensi nota.',
      'Tinjau flag peringatan dari Guard Anti-Fraud jika ada potensi split claim atau nominal tinggi.',
      'Klik Setujui atau Tolak, pilih alasan keputusan, lalu konfirmasi untuk memperbarui saldo divisi.',
    ],
    rulesAndGuards: [
      'Penyetuju tidak boleh sama dengan pemohon (Self-Approval Guard).',
      'Penolakan wajib disertai alasan yang jelas dan keputusan final bersifat permanen.',
      'Pengajuan pada bulan yang sudah berstatus Terkunci tidak dapat diputuskan.',
    ],
    keywords: ['approval', 'direktur', 'setujui', 'tolak', 'struk'],
  },
  {
    id: 'down-payments',
    order: 3,
    title: 'Kasbon (Uang Muka) & Realisasi Struk',
    shortTitle: 'Kasbon & Realisasi',
    category: 'core',
    categoryLabel: 'Operasional Harian',
    targetTab: 'down-payments',
    summary:
      'Pengelolaan uang muka operasional (Kasbon) mulai dari pengajuan, pencairan oleh Direktur, hingga realisasi struk belanja, pengembalian sisa dana, dan verifikasi QR Code.',
    keyCapabilities: [
      'Melacak siklus penuh kasbon: Pending -> Open/Dicairkan -> Settled/Direalisasikan atau Rejected.',
      'Menghitung selisih realisasi otomatis (sisa dana dikembalikan ke kas atau kekurangan dibayarkan).',
      'Menghasilkan tautan & QR Code verifikasi unik per transaksi kasbon untuk pengecekan cepat struk dan detail.',
    ],
    workflowSteps: [
      'Ajukan kasbon baru untuk kebutuhan lapangan (BBM, tol, bongkar muat) dengan estimasi nominal.',
      'Direktur menyetujui dan mencairkan dana kasbon sehingga saldo divisi langsung tercadangkan.',
      'Setelah belanja selesai, unggah foto bukti struk dan input nominal realisasi aktual.',
      'Gunakan tombol Struk & QR atau QR & Detail untuk membagikan/memindai tautan verifikasi struk.',
    ],
    rulesAndGuards: [
      'Satu pemohon tidak diperbolehkan menumpuk kasbon aktif ganda (maksimal 1 kasbon aktif per orang).',
      'Realisasi kasbon wajib melampirkan foto struk dan nomor referensi nota unik.',
    ],
    keywords: ['kasbon', 'uang muka', 'realisasi', 'qr code', 'verifikasi struk'],
  },
  {
    id: 'departments',
    order: 4,
    title: 'Saldo, Top-Up & Cash Opname Divisi',
    shortTitle: 'Saldo & Opname',
    category: 'control',
    categoryLabel: 'Kontrol & Audit Kas',
    targetTab: 'departments',
    summary:
      'Manajemen pagu anggaran bulanan tiap divisi, pengisian ulang (top-up) kas kecil, serta pencatatan Cash Opname fisik untuk mendeteksi selisih uang tunai.',
    keyCapabilities: [
      'Menampilkan sisa saldo, anggaran bulanan, dan rasio pemakaian kas per divisi operasional.',
      'Mencatat transaksi Top-Up kas dari rekening pusat ke pemegang kas kecil divisi.',
      'Menjalankan rekonsiliasi Cash Opname antara saldo sistem dan uang tunai fisik di brankas.',
    ],
    workflowSteps: [
      'Pantau kartu divisi untuk melihat saldo berjalan dan indikator batas minimum.',
      'Klik Top-Up Saldo untuk menambah dana kas kecil divisi beserta referensi transfer.',
      'Lakukan Cash Opname berkala dengan menghitung uang fisik dan mencatat selisih jika ada.',
    ],
    rulesAndGuards: [
      'Jika hasil Cash Opname mengalami selisih minus/kurang (shortage), operator wajib mengisi keterangan selisih.',
      'Top-Up dan perubahan anggaran tidak dapat dilakukan pada divisi nonaktif atau periode terkunci.',
    ],
    keywords: ['divisi', 'saldo', 'top-up', 'opname', 'selisih kas'],
  },
  {
    id: 'closing',
    order: 5,
    title: 'Tutup Kas Harian & Kunci Periode Bulanan',
    shortTitle: 'Closing & Periode',
    category: 'control',
    categoryLabel: 'Kontrol & Audit Kas',
    targetTab: 'closing',
    summary:
      'Penutupan kas harian (Daily Closing) untuk verifikasi saldo awal-akhir dan penguncian buku periode bulanan (Monthly Period Lock) guna menjaga integritas laporan.',
    keyCapabilities: [
      'Menghitung mutasi masuk/keluar harian dan mencocokkan saldo tutup kas fisik.',
      'Mengunci periode bulanan agar transaksi historis tidak bisa diubah atau disisipkan.',
      'Menyediakan kontrol pembukaan kembali periode (reopen) khusus Direktur dengan alasan audit.',
    ],
    workflowSteps: [
      'Pastikan seluruh pengajuan pending dan selisih kas harian telah diselesaikan.',
      'Buat catatan Tutup Kas Harian di akhir jam operasional.',
      'Pada akhir bulan, lakukan Kunci Periode Bulanan setelah semua antrean persetujuan bersih.',
    ],
    rulesAndGuards: [
      'Periode bulanan tidak dapat dikunci jika masih terdapat pengajuan pending pada bulan tersebut.',
      'Transaksi baru pada tanggal yang termasuk periode terkunci otomatis ditolak oleh server.',
    ],
    keywords: ['closing', 'tutup kas', 'kunci periode', 'lock', 'reopen'],
  },
  {
    id: 'activity-log',
    order: 6,
    title: 'Log Aktivitas & Audit Trail SHA-256',
    shortTitle: 'Audit Log SHA-256',
    category: 'control',
    categoryLabel: 'Kontrol & Audit Kas',
    targetTab: 'activity-log',
    summary:
      'Jejak audit kronologis berantai kriptografi (hash-chained SHA-256) yang merekam pelaku, peran, waktu akurat, dan payload perubahan untuk mendeteksi manipulasi data.',
    keyCapabilities: [
      'Menghubungkan setiap entri log dengan hash entri sebelumnya (tamper-evident chain).',
      'Memverifikasi keutuhan seluruh rantai log secara otomatis setiap kali snapshot dimuat.',
      'Mendukung ekspor CSV audit trail dengan perlindungan formula injection.',
    ],
    workflowSteps: [
      'Buka tab Log Aktivitas untuk menelusuri riwayat persetujuan, login, RBAC, dan mutasi kas.',
      'Periksa banner Status Integritas Rantai Audit SHA-256 di bagian atas.',
      'Unduh CSV audit log jika diperlukan pemeriksaan eksternal atau arsip akuntansi.',
    ],
    rulesAndGuards: [
      'Perubahan nominal, aktor, timestamp, atau penghapusan baris log akan memutus rantai hash dan memicu peringatan tamper.',
      'Sel nilai CSV diawali karakter formula Excel (=, +, -, @) otomatis dinetralkan.',
    ],
    keywords: ['audit', 'log', 'sha-256', 'hash chain', 'csv'],
  },
  {
    id: 'reports',
    order: 7,
    title: 'Laporan Mutasi & Pengeluaran Bulanan',
    shortTitle: 'Laporan Bulanan',
    category: 'control',
    categoryLabel: 'Kontrol & Audit Kas',
    targetTab: 'reports',
    summary:
      'Rekapitulasi buku besar mutasi kas kecil, breakdown pengeluaran per kategori & divisi, serta rekonsiliasi realisasi kasbon untuk pelaporan keuangan bulanan.',
    keyCapabilities: [
      'Menyajikan buku mutasi (Cash Ledger) terurut kronologis lengkap dengan saldo berjalan.',
      'Mengelompokkan total pengeluaran per kategori operasional dan per divisi.',
      'Ekspor laporan mutasi ke CSV yang aman dibuka di Excel/Spreadsheet.',
    ],
    workflowSteps: [
      'Pilih bulan laporan dan filter divisi bila ingin meninjau unit tertentu.',
      'Periksa ringkasan total pengeluaran klaim, pencairan kasbon, pengembalian kasbon, dan top-up.',
      'Klik Ekspor CSV untuk menyimpan salinan buku mutasi.',
    ],
    rulesAndGuards: [
      'Hanya transaksi berstatus disetujui/dicairkan/direalisasikan yang dihitung sebagai arus kas aktual.',
      'Pengembalian sisa dana kasbon tercatat otomatis sebagai arus kas masuk.',
    ],
    keywords: ['laporan', 'mutasi', 'ledger', 'bulanan', 'ekspor csv'],
  },
  {
    id: 'master',
    order: 8,
    title: 'Data Master Divisi, Karyawan, Kategori & Armada',
    shortTitle: 'Data Master',
    category: 'admin',
    categoryLabel: 'Master & Keamanan',
    targetTab: 'master',
    summary:
      'Pengelolaan data referensi operasional meliputi divisi, karyawan pemohon, kategori biaya, dan unit truk/armada yang dapat diaktifkan atau dinonaktifkan.',
    keyCapabilities: [
      'Menambah dan memperbarui data divisi, pagu bulanan, serta ambang peringatan saldo.',
      'Mengelola daftar karyawan, kategori pengeluaran, dan nomor polisi armada kargo.',
      'Mendukung penonaktifan (soft-disable) data master tanpa merusak riwayat transaksi lama.',
    ],
    workflowSteps: [
      'Pilih sub-tab master yang ingin diperbarui (Divisi, Karyawan, Kategori, atau Armada).',
      'Tambahkan entri baru atau ubah status aktif/nonaktif sesuai kebutuhan operasional.',
      'Simpan perubahan agar langsung tersedia di form pengajuan dan laporan.',
    ],
    rulesAndGuards: [
      'Divisi, karyawan, kategori, atau armada yang berstatus nonaktif tidak bisa dipilih pada transaksi baru.',
      'Perubahan master data dicatat dalam jejak aktivitas server.',
    ],
    keywords: ['master', 'divisi', 'karyawan', 'kategori', 'armada'],
  },
  {
    id: 'fraud-guard',
    order: 9,
    title: 'Guard Anti-Fraud & Deteksi Pecah Nota',
    shortTitle: 'Guard Anti-Fraud',
    category: 'modules',
    categoryLabel: 'Modul Opsional',
    targetTab: 'fraud-guard',
    optionalModuleKey: 'fraudGuard',
    summary:
      'Mesin aturan anti-kecurangan untuk mencegah klaim fiktif, duplikasi nomor struk, pemecahan nota (split claim), klaim armada ganda, dan transaksi melebihi plafon.',
    keyCapabilities: [
      'Mendeteksi klaim terpecah (split claim) dalam jendela waktu konfigurabel dan klaim ganda pada armada sama di hari sama.',
      'Memblokir penggunaan ulang nomor referensi nota (double billing) lintas klaim dan kasbon.',
      'Menegakkan kewajiban lampiran foto struk dan batas maksimal nominal per pengajuan.',
    ],
    workflowSteps: [
      'Aktifkan modul Guard Anti-Fraud dan atur batas nominal tunggal serta jendela deteksi duplikat.',
      'Tinjau temuan peringatan risiko pada daftar pengajuan yang ditandai sistem.',
      'Lakukan penyesuaian kebijakan nilai ambang bila kebijakan limit perusahaan berubah.',
    ],
    rulesAndGuards: [
      'Nomor struk yang identik setelah normalisasi format otomatis ditolak.',
      'Batas maksimal transaksi tunggal divalidasi di sisi server sebelum pengajuan disimpan.',
    ],
    keywords: ['fraud', 'pecah nota', 'duplikat', 'plafon', 'anti-fraud'],
  },
  {
    id: 'forecast',
    order: 10,
    title: 'Forecast & Ketahanan Runway Kas',
    shortTitle: 'Forecast Kas',
    category: 'modules',
    categoryLabel: 'Modul Opsional',
    targetTab: 'forecast',
    optionalModuleKey: 'forecastModule',
    summary:
      'Proyeksi ketahanan saldo petty cash berdasarkan rata-rata burn-rate harian untuk memperkirakan sisa hari operasional (cash runway) dan kebutuhan top-up.',
    keyCapabilities: [
      'Menghitung rata-rata pengeluaran harian berdasarkan jendela historis yang dapat disesuaikan.',
      'Memproyeksikan tanggal perkiraan saldo habis dan rekomendasi nominal pengisian ulang.',
      'Menangani kondisi cold-start (belum ada riwayat transaksi) secara aman tanpa error pembagian nol.',
    ],
    workflowSteps: [
      'Aktifkan modul Forecast & Ketahanan Kas dan tentukan periode jendela analisis (mis. 14 atau 30 hari).',
      'Pantau estimasi runway hari tersisa untuk setiap divisi maupun total perusahaan.',
      'Gunakan rekomendasi top-up sebagai dasar pengajuan pengisian kas ke bagian keuangan pusat.',
    ],
    rulesAndGuards: [
      'Perhitungan proyeksi selalu menghasilkan angka terhingga yang aman bahkan ketika histori pengeluaran masih nol.',
    ],
    keywords: ['forecast', 'runway', 'burn rate', 'proyeksi', 'ketahanan kas'],
  },
  {
    id: 'tax',
    order: 11,
    title: 'Modul Pajak Indonesia (PPN, PPh 23 & PPh 21)',
    shortTitle: 'Pajak Indonesia',
    category: 'modules',
    categoryLabel: 'Modul Opsional',
    targetTab: 'tax',
    optionalModuleKey: 'taxModule',
    summary:
      'Kalkulasi otomatis komponen pajak Indonesia (PPN 11%, PPh Pasal 23 jasa 2%, serta PPh 21) pada pengajuan biaya untuk memisahkan nilai dasar, potongan pajak, dan kas dibayarkan.',
    keyCapabilities: [
      'Menghitung PPN eksklusif/inklusif, PPh 23 (2%), dan PPh 21 secara presisi dalam bilangan bulat Rupiah.',
      'Memungkinkan aktivasi selektif per jenis skema pajak sesuai kebutuhan kepatuhan perusahaan.',
      'Menyimpan rincian dasar pengenaan pajak dan nominal neto dicairkan pada setiap transaksi.',
    ],
    workflowSteps: [
      'Aktifkan modul Pajak Indonesia dan centang skema pajak yang berlaku.',
      'Saat membuat pengajuan baru, pilih skema pajak yang sesuai pada transaksi jasa atau vendor.',
      'Periksa rincian nilai bruto, potongan pajak, dan total kas bersih sebelum mengirim pengajuan.',
    ],
    rulesAndGuards: [
      'Skema pajak yang dinonaktifkan di pengaturan modul tidak dapat digunakan pada transaksi baru.',
      'Saldo divisi dipotong sebesar nominal neto kas yang benar-benar dicairkan.',
    ],
    keywords: ['pajak', 'ppn', 'pph 23', 'pph 21', 'netto'],
  },
  {
    id: 'whatsapp',
    order: 12,
    title: 'Notifikasi WhatsApp & Log Pengiriman',
    shortTitle: 'WhatsApp Gateway',
    category: 'modules',
    categoryLabel: 'Modul Opsional',
    targetTab: 'whatsapp',
    optionalModuleKey: 'whatsappModule',
    summary:
      'Integrasi pengiriman ringkasan pengajuan dan persetujuan petty cash ke nomor WhatsApp Direktur/PIC melalui gateway server atau tautan wa.me.',
    keyCapabilities: [
      'Menyusun format pesan ringkasan pengajuan/keputusan yang siap dikirim ke pihak terkait.',
      'Mendukung pengiriman via token gateway server-side maupun deep-link WhatsApp.',
      'Mencatat log status pengiriman pesan agar tim admin mudah memantau riwayat notifikasi.',
    ],
    workflowSteps: [
      'Aktifkan modul Notifikasi WhatsApp dan atur nomor tujuan default Direktur/Keuangan.',
      'Gunakan tombol kirim notifikasi dari detail pengajuan atau panel WhatsApp.',
      'Pantau riwayat pengiriman pada tabel log pesan WhatsApp.',
    ],
    rulesAndGuards: [
      'Token API WhatsApp disimpan eksklusif di environment server dan tidak pernah dikirim ke browser.',
    ],
    keywords: ['whatsapp', 'notifikasi', 'gateway', 'wa.me', 'pesan'],
  },
  {
    id: 'modules',
    order: 13,
    title: 'Pusat Modul Opsional',
    shortTitle: 'Pusat Modul',
    category: 'admin',
    categoryLabel: 'Master & Keamanan',
    targetTab: 'modules',
    summary:
      'Panel terpusat untuk mengaktifkan, menonaktifkan, dan mengonfigurasi seluruh modul tambahan (Guard Anti-Fraud, Forecast Kas, Pajak Indonesia, dan WhatsApp).',
    keyCapabilities: [
      'Menyajikan status aktif/nonaktif seluruh modul opsional dalam satu layar kontrol.',
      'Mengizinkan aktivasi bertahap sesuai kesiapan SOP dan kompleksitas operasional cabang.',
    ],
    workflowSteps: [
      'Buka Pusat Modul dengan akun yang memiliki hak akses pengelolaan modul.',
      'Aktifkan modul yang dibutuhkan dan lanjutkan konfigurasi parameter pada tab modul terkait.',
    ],
    rulesAndGuards: [
      'Perubahan status modul memerlukan permission khusus dan langsung menyinkronkan tampilan menu pengguna.',
    ],
    keywords: ['modul', 'pusat modul', 'fitur opsional', 'konfigurasi'],
  },
  {
    id: 'rbac',
    order: 14,
    title: 'Role, Permission, Sesi & Kebijakan Keamanan (RBAC)',
    shortTitle: 'RBAC & Keamanan',
    category: 'admin',
    categoryLabel: 'Master & Keamanan',
    targetTab: 'rbac',
    summary:
      'Pengaturan role dinamis, izin granular per aksi, manajemen akun pengguna, rotasi sesi Refresh Token, dan kebijakan anti-bruteforce.',
    keyCapabilities: [
      'Mengelola daftar role beserta matriks permission per modul (view, create, approve, export, manage).',
      'Membuat, menonaktifkan, dan mengatur role pengguna beserta pencabutan sesi aktif (revoke session).',
      'Mengatur TTL Access Token, Refresh Token, rate limiter, dan ambang lockout gagal login.',
    ],
    workflowSteps: [
      'Tinjau atau buat role kustom pada tab Role & Permission sesuai struktur organisasi.',
      'Tambahkan akun staf/finance/auditor di panel Manajemen Pengguna.',
      'Pantau sesi login aktif dan sesuaikan kebijakan keamanan token bila diperlukan.',
    ],
    rulesAndGuards: [
      'Role Direktur (System Admin) memiliki permission keamanan terkunci agar tidak dapat mengunci dirinya sendiri.',
      'Setiap token Refresh bersifat sekali pakai (rotation) dan reuse terdeteksi otomatis mencabut sesi.',
    ],
    keywords: ['rbac', 'role', 'permission', 'user', 'keamanan', 'sesi'],
  },
  {
    id: 'skenario-fraud-negative-worst',
    order: 15,
    title: 'Skenario Uji Negative, Worst-Case & Anti-Fraud',
    shortTitle: 'Skenario Uji & Fraud',
    category: 'control',
    categoryLabel: 'Kontrol & Audit Kas',
    targetTab: 'fraud-guard',
    summary:
      'Ringkasan skenario pengujian menyeluruh yang mencakup percobaan kecurangan (pecah nota, double billing, self-approval, manipulasi hash), input negatif, dan krisis likuiditas.',
    keyCapabilities: [
      'Mendokumentasikan 7 skenario anti-fraud, 4 skenario negative-case, 3 worst-case likuiditas, serta uji ketahanan API.',
      'Tervalidasi secara otomatis melalui test suite unit dan integrasi server (`npm test`).',
    ],
    workflowSteps: [
      'Pelajari daftar skenario pada dokumen SCENARIOS.md atau jalankan pengujian `npm test`.',
      'Gunakan Guard Anti-Fraud dan Audit Log SHA-256 untuk memantau pelanggaran di lingkungan produksi.',
    ],
    rulesAndGuards: [
      'Seluruh validasi nominal, permission RBAC, lock periode, dan deteksi duplikat ditegakkan di backend server.',
    ],
    keywords: ['skenario', 'fraud', 'negative test', 'worst case', 'pengujian'],
  },
];
