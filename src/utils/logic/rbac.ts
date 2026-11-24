import type { NavTab } from '../../components/Sidebar.tsx';
import type {
  PermissionKey,
  RbacRole,
  RbacRoleId,
} from '../../types/pettycash.ts';

export interface PermissionItemDef {
  key: PermissionKey;
  label: string;
  description: string;
  kind: 'menu' | 'action';
}

export interface PermissionMenuGroup {
  groupId: string;
  menuLabel: string;
  description: string;
  items: PermissionItemDef[];
}

export const PERMISSION_GROUPS: PermissionMenuGroup[] = [
  {
    groupId: 'dashboard',
    menuLabel: 'Dashboard Real-Time',
    description: 'Pantauan saldo kas, KPI, dan Indeks Kesehatan Kas.',
    items: [
      {
        key: 'dashboard:view',
        label: 'Akses Menu Dashboard',
        description: 'Melihat ringkasan saldo divisi, KPI, dan grafik kesehatan kas.',
        kind: 'menu',
      },
    ],
  },
  {
    groupId: 'approvals',
    menuLabel: 'Pengajuan & Approval Petty Cash',
    description: 'Pengajuan pengeluaran kas kecil dan keputusan persetujuan.',
    items: [
      {
        key: 'approvals:view',
        label: 'Akses Menu Approval',
        description: 'Melihat daftar pengajuan petty cash dan riwayat keputusan.',
        kind: 'menu',
      },
      {
        key: 'requests:create',
        label: 'Aksi Buat Pengajuan Petty Cash',
        description: 'Mengirim pengajuan pengeluaran kas kecil baru (+ Ajukan).',
        kind: 'action',
      },
      {
        key: 'requests:decide',
        label: 'Aksi Setujui / Tolak Pengajuan',
        description: 'Memutus persetujuan atau penolakan pengajuan petty cash.',
        kind: 'action',
      },
    ],
  },
  {
    groupId: 'down-payments',
    menuLabel: 'Kasbon & Realisasi Struk',
    description: 'Pengelolaan uang muka operasional dan pertanggungjawaban struk.',
    items: [
      {
        key: 'down_payments:view',
        label: 'Akses Menu Kasbon',
        description: 'Melihat daftar kasbon, status jatuh tempo, dan realisasi.',
        kind: 'menu',
      },
      {
        key: 'down_payments:create',
        label: 'Aksi Ajukan Kasbon',
        description: 'Membuat pengajuan uang muka (kasbon) baru.',
        kind: 'action',
      },
      {
        key: 'down_payments:decide',
        label: 'Aksi Setujui / Tolak Kasbon',
        description: 'Memutus pencairan atau penolakan pengajuan kasbon.',
        kind: 'action',
      },
      {
        key: 'down_payments:settle',
        label: 'Aksi Realisasi Struk Kasbon',
        description: 'Mencatat struk aktual serta selisih refund/reimburse.',
        kind: 'action',
      },
    ],
  },
  {
    groupId: 'departments',
    menuLabel: 'Saldo Divisi, Mutasi & Cash Opname',
    description: 'Kontrol brankas kas kecil per divisi, top-up, dan opname fisik.',
    items: [
      {
        key: 'departments:view',
        label: 'Akses Menu Saldo Divisi & Mutasi',
        description: 'Melihat saldo divisi, buku mutasi kas, dan arsip opname.',
        kind: 'menu',
      },
      {
        key: 'departments:topup',
        label: 'Aksi Top-Up Saldo Divisi',
        description: 'Menambah saldo kas kecil divisi (imprest/top-up).',
        kind: 'action',
      },
      {
        key: 'departments:edit',
        label: 'Aksi Ubah Plafon & Pengaturan Divisi',
        description: 'Mengubah PIC, plafon bulanan, dan batas aman saldo.',
        kind: 'action',
      },
      {
        key: 'opname:create',
        label: 'Aksi Catat Cash Opname Fisik',
        description: 'Menyimpan berita acara hitung pecahan uang fisik.',
        kind: 'action',
      },
    ],
  },
  {
    groupId: 'closing',
    menuLabel: 'Tutup Kas & Kunci Periode',
    description: 'Cut-off tutup kas harian dan penguncian buku bulanan.',
    items: [
      {
        key: 'closing:view',
        label: 'Akses Menu Tutup Kas & Periode',
        description: 'Melihat ringkasan tutup kas harian dan status periode bulan.',
        kind: 'menu',
      },
      {
        key: 'closing:daily',
        label: 'Aksi Tutup Kas Harian',
        description: 'Mencatat berita acara tutup kas harian per divisi.',
        kind: 'action',
      },
      {
        key: 'closing:lock_period',
        label: 'Aksi Kunci Periode Bulanan',
        description: 'Menutup dan mengunci transaksi pada periode bulanan.',
        kind: 'action',
      },
      {
        key: 'closing:reopen_period',
        label: 'Aksi Buka Kunci Periode',
        description: 'Membuka kembali periode yang terkunci untuk koreksi.',
        kind: 'action',
      },
    ],
  },
  {
    groupId: 'reports',
    menuLabel: 'Laporan Bulanan & Armada',
    description: 'Analisa pengeluaran MoM, kategori biaya, dan biaya per truk.',
    items: [
      {
        key: 'reports:view',
        label: 'Akses Menu Laporan Bulanan',
        description: 'Melihat laporan realisasi biaya bulanan & armada.',
        kind: 'menu',
      },
      {
        key: 'reports:export',
        label: 'Aksi Ekspor CSV & Cetak Laporan',
        description: 'Mengunduh file CSV laporan bulanan, mutasi, & armada.',
        kind: 'action',
      },
    ],
  },
  {
    groupId: 'activity-log',
    menuLabel: 'Log Aktivitas Audit (SHA-256)',
    description: 'Rekam jejak anti-tampering autentikasi, RBAC, dan approval.',
    items: [
      {
        key: 'activity_log:view',
        label: 'Akses Menu Log Aktivitas Audit',
        description: 'Melihat audit trail rantai hash SHA-256 dan verifikasi.',
        kind: 'menu',
      },
      {
        key: 'activity_log:export',
        label: 'Aksi Ekspor CSV Audit Trail',
        description: 'Mengunduh salinan CSV log aktivitas berantai hash.',
        kind: 'action',
      },
    ],
  },
  {
    groupId: 'master',
    menuLabel: 'Data Master Operasional',
    description: 'Referensi divisi, karyawan/driver, kategori, dan armada truk.',
    items: [
      {
        key: 'master:view',
        label: 'Akses Menu Data Master',
        description: 'Melihat daftar karyawan, kategori biaya, dan armada.',
        kind: 'menu',
      },
      {
        key: 'master:manage',
        label: 'Aksi Tambah & Ubah Data Master',
        description: 'Membuat atau mengubah data master dan status aktif.',
        kind: 'action',
      },
    ],
  },
  {
    groupId: 'modules',
    menuLabel: 'Pusat Modul & Modul Opsional',
    description: 'Guard Anti-Fraud, Forecast Kas, Pajak Indonesia, dan WhatsApp.',
    items: [
      {
        key: 'modules:view',
        label: 'Akses Menu Modul & Pusat Modul',
        description: 'Melihat halaman Pusat Modul dan modul opsional aktif.',
        kind: 'menu',
      },
      {
        key: 'modules:manage',
        label: 'Aksi Konfigurasi & Toggle Modul',
        description: 'Mengaktifkan/menonaktifkan modul dan mengubah aturan guard.',
        kind: 'action',
      },
      {
        key: 'whatsapp:dispatch',
        label: 'Aksi Kirim / Catat Notifikasi WhatsApp',
        description: 'Mencatat pengiriman notifikasi WA ke Direktur.',
        kind: 'action',
      },
    ],
  },
  {
    groupId: 'wiki',
    menuLabel: 'Panduan & Wiki Fitur',
    description: 'Dokumentasi interaktif seluruh fitur dan aturan operasional.',
    items: [
      {
        key: 'wiki:view',
        label: 'Akses Menu Wiki & Panduan',
        description: 'Membaca panduan penggunaan fitur aplikasi.',
        kind: 'menu',
      },
    ],
  },
  {
    groupId: 'rbac',
    menuLabel: 'Role, Permission & Aksi (Keamanan)',
    description: 'Pengaturan RBAC dinamis, akun pengguna, sesi, dan rate limit.',
    items: [
      {
        key: 'rbac:view',
        label: 'Akses Menu Role & Permission',
        description: 'Melihat daftar role, matriks izin, pengguna, dan sesi aktif.',
        kind: 'menu',
      },
      {
        key: 'rbac:manage_roles',
        label: 'Aksi Kelola Role & Matriks Permission',
        description: 'Membuat, mengubah, atau menghapus role dan izin aksi.',
        kind: 'action',
      },
      {
        key: 'rbac:manage_users',
        label: 'Aksi Kelola Pengguna, Sesi & Kebijakan',
        description: 'Menambah akun, mengubah role user, mencabut sesi, & TTL.',
        kind: 'action',
      },
    ],
  },
];

export const ALL_PERMISSION_KEYS: PermissionKey[] = PERMISSION_GROUPS.flatMap(
  (g) => g.items.map((item) => item.key)
);

export const VALID_PERMISSION_SET = new Set<PermissionKey>(ALL_PERMISSION_KEYS);

export const PERMISSION_LABEL_MAP: Record<PermissionKey, string> =
  Object.fromEntries(
    PERMISSION_GROUPS.flatMap((g) => g.items.map((i) => [i.key, i.label]))
  ) as Record<PermissionKey, string>;

export const TAB_REQUIRED_PERMISSION: Record<NavTab, PermissionKey> = {
  dashboard: 'dashboard:view',
  approvals: 'approvals:view',
  'down-payments': 'down_payments:view',
  departments: 'departments:view',
  closing: 'closing:view',
  reports: 'reports:view',
  'activity-log': 'activity_log:view',
  master: 'master:view',
  modules: 'modules:view',
  'fraud-guard': 'modules:view',
  forecast: 'modules:view',
  tax: 'modules:view',
  whatsapp: 'modules:view',
  wiki: 'wiki:view',
  rbac: 'rbac:view',
};

export const TAB_FALLBACK_ORDER: NavTab[] = [
  'dashboard',
  'approvals',
  'down-payments',
  'departments',
  'closing',
  'reports',
  'activity-log',
  'master',
  'modules',
  'rbac',
  'wiki',
];

export const VALID_NAV_TABS = new Set<NavTab>([
  'dashboard',
  'approvals',
  'down-payments',
  'departments',
  'closing',
  'reports',
  'activity-log',
  'master',
  'modules',
  'wiki',
  'fraud-guard',
  'forecast',
  'tax',
  'whatsapp',
  'rbac',
]);

export function hasPermission(
  permissions: readonly PermissionKey[] | undefined,
  required: PermissionKey
): boolean {
  if (!permissions || permissions.length === 0) return false;
  return permissions.includes(required);
}

export function canAccessTab(
  permissions: readonly PermissionKey[] | undefined,
  tab: NavTab
): boolean {
  const reqPerm = TAB_REQUIRED_PERMISSION[tab];
  return hasPermission(permissions, reqPerm);
}

export function getFirstPermittedTab(
  permissions: readonly PermissionKey[] | undefined,
  preferredTab?: NavTab | null,
  moduleFlags?: {
    fraudGuard?: boolean;
    forecastModule?: boolean;
    taxModule?: boolean;
    whatsappModule?: boolean;
  }
): NavTab {
  const isModuleTabActive = (tab: NavTab): boolean => {
    if (!moduleFlags) return true;
    if (tab === 'fraud-guard') return Boolean(moduleFlags.fraudGuard);
    if (tab === 'forecast') return Boolean(moduleFlags.forecastModule);
    if (tab === 'tax') return Boolean(moduleFlags.taxModule);
    if (tab === 'whatsapp') return Boolean(moduleFlags.whatsappModule);
    return true;
  };

  if (
    preferredTab &&
    VALID_NAV_TABS.has(preferredTab) &&
    canAccessTab(permissions, preferredTab) &&
    isModuleTabActive(preferredTab)
  ) {
    return preferredTab;
  }

  for (const tab of TAB_FALLBACK_ORDER) {
    if (canAccessTab(permissions, tab) && isModuleTabActive(tab)) {
      return tab;
    }
  }
  return 'wiki';
}

export const SYSTEM_ADMIN_ROLE_ID: RbacRoleId = 'role-director';

export const SYSTEM_ADMIN_LOCKED_PERMISSIONS: PermissionKey[] = [
  'dashboard:view',
  'rbac:view',
  'rbac:manage_roles',
  'rbac:manage_users',
  'activity_log:view',
];

export function createDefaultRbacRoles(nowIso: string): RbacRole[] {
  return [
    {
      id: 'role-director',
      name: 'Direktur (Super Admin)',
      slug: 'director',
      description:
        'Otoritas penuh persetujuan langsung, kunci periode, manajemen role/user, dan pengawasan audit.',
      permissions: [...ALL_PERMISSION_KEYS],
      isSystem: true,
      updatedAt: nowIso,
    },
    {
      id: 'role-finance',
      name: 'Admin Keuangan / Kasir',
      slug: 'finance',
      description:
        'Mengelola top-up saldo divisi, cash opname, tutup kas harian, realisasi kasbon, dan data master.',
      permissions: [
        'dashboard:view',
        'approvals:view',
        'requests:create',
        'down_payments:view',
        'down_payments:create',
        'down_payments:settle',
        'departments:view',
        'departments:topup',
        'departments:edit',
        'opname:create',
        'closing:view',
        'closing:daily',
        'reports:view',
        'reports:export',
        'activity_log:view',
        'master:view',
        'master:manage',
        'modules:view',
        'whatsapp:dispatch',
        'wiki:view',
      ],
      isSystem: false,
      updatedAt: nowIso,
    },
    {
      id: 'role-staff',
      name: 'Staff Operasional',
      slug: 'staff',
      description:
        'Mengajukan petty cash & kasbon operasional, melihat status antrean, dan membaca panduan wiki.',
      permissions: [
        'dashboard:view',
        'approvals:view',
        'requests:create',
        'down_payments:view',
        'down_payments:create',
        'down_payments:settle',
        'wiki:view',
      ],
      isSystem: false,
      updatedAt: nowIso,
    },
    {
      id: 'role-auditor',
      name: 'Auditor Internal (Read-Only)',
      slug: 'auditor',
      description:
        'Akses baca penuh seluruh laporan, buku mutasi, opname, guard anti-fraud, dan ekspor audit trail SHA-256.',
      permissions: [
        'dashboard:view',
        'approvals:view',
        'down_payments:view',
        'departments:view',
        'closing:view',
        'reports:view',
        'reports:export',
        'activity_log:view',
        'activity_log:export',
        'master:view',
        'modules:view',
        'wiki:view',
      ],
      isSystem: false,
      updatedAt: nowIso,
    },
  ];
}

export function sanitizeRoleSlug(rawName: string): string {
  return rawName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);
}

export function normalizeEmailAddress(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isValidEmailFormat(raw: string): boolean {
  const email = normalizeEmailAddress(raw);
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) && email.length <= 120;
}

export function validatePasswordStrength(password: string): {
  valid: boolean;
  error?: string;
} {
  if (typeof password !== 'string' || password.length < 8) {
    return {
      valid: false,
      error: 'Kata sandi minimal 8 karakter.',
    };
  }
  if (password.length > 128) {
    return {
      valid: false,
      error: 'Kata sandi maksimal 128 karakter.',
    };
  }
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasDigit = /\d/.test(password);
  if (!hasLetter || !hasDigit) {
    return {
      valid: false,
      error: 'Kata sandi harus mengandung kombinasi huruf dan angka.',
    };
  }
  return { valid: true };
}

export function validateRolePayload(params: {
  name: string;
  description: string;
  permissions: unknown;
  isSystemRole?: boolean;
}): {
  valid: boolean;
  error?: string;
  normalized?: {
    name: string;
    description: string;
    permissions: PermissionKey[];
  };
} {
  const name = (params.name ?? '').trim().replace(/\s+/g, ' ');
  if (name.length < 2 || name.length > 50) {
    return {
      valid: false,
      error: 'Nama role harus 2–50 karakter.',
    };
  }
  const description = (params.description ?? '').trim().slice(0, 200);
  if (!Array.isArray(params.permissions)) {
    return {
      valid: false,
      error: 'Daftar permission role harus berupa array.',
    };
  }
  const uniquePerms: PermissionKey[] = [];
  const seen = new Set<PermissionKey>();
  for (const rawPerm of params.permissions) {
    if (
      typeof rawPerm === 'string' &&
      VALID_PERMISSION_SET.has(rawPerm as PermissionKey) &&
      !seen.has(rawPerm as PermissionKey)
    ) {
      seen.add(rawPerm as PermissionKey);
      uniquePerms.push(rawPerm as PermissionKey);
    }
  }
  if (params.isSystemRole) {
    for (const lockedPerm of SYSTEM_ADMIN_LOCKED_PERMISSIONS) {
      if (!seen.has(lockedPerm)) {
        seen.add(lockedPerm);
        uniquePerms.push(lockedPerm);
      }
    }
  }
  if (uniquePerms.length === 0) {
    return {
      valid: false,
      error: 'Pilih minimal 1 menu atau aksi izin untuk role ini.',
    };
  }
  return {
    valid: true,
    normalized: {
      name,
      description,
      permissions: uniquePerms,
    },
  };
}
