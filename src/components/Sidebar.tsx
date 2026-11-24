import {
  Banknote,
  BookOpen,
  Building2,
  CheckSquare,
  Database,
  FileBarChart2,
  History,
  KeyRound,
  Layers,
  LayoutDashboard,
  Lock,
  LogOut,
  MessageSquare,
  Receipt,
  RefreshCw,
  ShieldCheck,
  TrendingUp,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import type {
  AuthUserPublic,
  PermissionKey,
  RbacRole,
} from '../types/pettycash.ts';
import { canAccessTab } from '../utils/pettycashLogic.ts';

export type NavTab =
  | 'dashboard'
  | 'approvals'
  | 'down-payments'
  | 'departments'
  | 'closing'
  | 'reports'
  | 'activity-log'
  | 'master'
  | 'modules'
  | 'wiki'
  | 'fraud-guard'
  | 'forecast'
  | 'tax'
  | 'whatsapp'
  | 'rbac';

interface SidebarProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  currentUser: AuthUserPublic;
  currentRole: RbacRole;
  userPermissions: readonly PermissionKey[];
  remainingSessionSeconds: number;
  isRefreshingSession: boolean;
  onRefreshSession: () => void;
  onLogout: () => void;
  pendingForRoleCount: number;
  totalPendingCount: number;
  activeKasbonCount?: number;
  taxModuleEnabled: boolean;
  forecastModuleEnabled: boolean;
  fraudGuardEnabled: boolean;
  whatsappModuleEnabled: boolean;
  sseConnected: boolean;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

interface NavItemDef {
  id: NavTab;
  label: string;
  icon: typeof LayoutDashboard;
}

interface NavGroupDef {
  groupLabel: string;
  items: NavItemDef[];
}

function formatCountdown(totalSeconds: number): string {
  if (totalSeconds <= 0) return '0d';
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  if (hrs > 0) return `${hrs}j ${mins}m`;
  if (mins > 0) return `${mins}m ${secs}d`;
  return `${secs}d`;
}

export function Sidebar({
  activeTab,
  onSelectTab,
  currentUser,
  currentRole,
  userPermissions,
  remainingSessionSeconds,
  isRefreshingSession,
  onRefreshSession,
  onLogout,
  pendingForRoleCount,
  totalPendingCount,
  activeKasbonCount = 0,
  taxModuleEnabled,
  forecastModuleEnabled,
  fraudGuardEnabled,
  whatsappModuleEnabled,
  sseConnected,
  mobileOpen,
  onCloseMobile,
}: SidebarProps) {
  const activeModules: NavItemDef[] = [
    ...(fraudGuardEnabled
      ? [
          {
            id: 'fraud-guard' as const,
            label: 'Guard Anti-Fraud',
            icon: ShieldCheck,
          },
        ]
      : []),
    ...(forecastModuleEnabled
      ? [
          {
            id: 'forecast' as const,
            label: 'Forecast Kas',
            icon: TrendingUp,
          },
        ]
      : []),
    ...(taxModuleEnabled
      ? [
          {
            id: 'tax' as const,
            label: 'Pajak Indonesia',
            icon: Receipt,
          },
        ]
      : []),
    ...(whatsappModuleEnabled
      ? [
          {
            id: 'whatsapp' as const,
            label: 'Notifikasi WhatsApp',
            icon: MessageSquare,
          },
        ]
      : []),
  ];

  const activeModuleCount = activeModules.length;

  const rawGroups: NavGroupDef[] = [
    {
      groupLabel: 'Operasional Kas',
      items: [
        { id: 'dashboard', label: 'Dashboard Real-Time', icon: LayoutDashboard },
        { id: 'approvals', label: 'Approval Direktur', icon: CheckSquare },
        { id: 'down-payments', label: 'Kasbon & Realisasi', icon: Banknote },
        { id: 'departments', label: 'Saldo Divisi Kargo', icon: Building2 },
        { id: 'closing', label: 'Tutup Kas & Periode', icon: Lock },
      ],
    },
    {
      groupLabel: 'Laporan & Data',
      items: [
        { id: 'reports', label: 'Laporan Bulanan', icon: FileBarChart2 },
        { id: 'activity-log', label: 'Log Aktivitas Audit', icon: History },
        { id: 'master', label: 'Data Master', icon: Database },
      ],
    },
    ...(activeModules.length > 0
      ? [
          {
            groupLabel: 'Modul Aktif',
            items: activeModules,
          },
        ]
      : []),
    {
      groupLabel: 'Sistem & Keamanan',
      items: [
        { id: 'modules', label: 'Pusat Modul', icon: Layers },
        { id: 'rbac', label: 'Role, Permission & Aksi', icon: KeyRound },
        { id: 'wiki', label: 'Panduan & Wiki Fitur', icon: BookOpen },
      ],
    },
  ];

  const navGroups = rawGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) =>
        canAccessTab(userPermissions, item.id)
      ),
    }))
    .filter((group) => group.items.length > 0);

  const sidebarBody = (
    <div className="flex h-full flex-col justify-between bg-white border-r border-slate-200">
      <div className="flex flex-col min-h-0 flex-1">
        <div className="flex items-center justify-between px-5 h-16 shrink-0 border-b border-slate-200">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-700 text-white font-semibold text-sm">
              K
            </div>
            <span className="font-display text-base font-bold tracking-tight text-slate-900 whitespace-nowrap">
              KasKu Kargo
            </span>
          </div>
          <button
            type="button"
            onClick={onCloseMobile}
            aria-label="Tutup menu navigasi"
            className="lg:hidden p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav
          aria-label="Menu Utama"
          className="flex-1 overflow-y-auto px-3 py-4 space-y-5"
        >
          {navGroups.map((group) => (
            <div key={group.groupLabel}>
              <p className="px-3 mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                {group.groupLabel}
              </p>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  const showCount =
                    item.id === 'approvals' &&
                    (pendingForRoleCount > 0 || totalPendingCount > 0);
                  const showKasbonCount =
                    item.id === 'down-payments' && activeKasbonCount > 0;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        onSelectTab(item.id);
                        onCloseMobile();
                      }}
                      aria-current={isActive ? 'page' : undefined}
                      className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-75 whitespace-nowrap ${
                        isActive
                          ? 'bg-emerald-50 text-emerald-800'
                          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                      }`}
                    >
                      <span className="flex items-center gap-2.5 truncate">
                        <Icon
                          className={`h-4 w-4 shrink-0 ${
                            isActive ? 'text-emerald-700' : 'text-slate-400'
                          }`}
                        />
                        <span className="truncate">{item.label}</span>
                      </span>
                      {showCount && (
                        <span
                          className={`font-mono tabular-nums text-xs ${
                            pendingForRoleCount > 0
                              ? 'font-semibold text-amber-700'
                              : 'text-slate-500'
                          }`}
                        >
                          {pendingForRoleCount > 0
                            ? pendingForRoleCount
                            : totalPendingCount}
                        </span>
                      )}
                      {showKasbonCount && (
                        <span className="font-mono tabular-nums text-xs font-semibold text-amber-700">
                          {activeKasbonCount}
                        </span>
                      )}
                      {item.id === 'modules' && (
                        <span
                          className={`font-mono text-[11px] ${
                            activeModuleCount > 0
                              ? 'font-semibold text-emerald-700'
                              : 'text-slate-400'
                          }`}
                        >
                          {activeModuleCount}/4
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </div>

      <div className="p-3.5 border-t border-slate-200 space-y-3 bg-slate-50/80 shrink-0">
        <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-900 truncate">
                {currentUser.name}
              </p>
              <p className="text-[11px] text-emerald-700 font-semibold truncate">
                {currentRole.name}
              </p>
              <p className="text-[10px] text-slate-400 truncate font-mono">
                {currentUser.email}
              </p>
            </div>
            <button
              type="button"
              onClick={onRefreshSession}
              disabled={isRefreshingSession}
              title="Perbarui Refresh Token"
              aria-label="Perbarui Refresh Token"
              className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-emerald-700 disabled:opacity-50"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${
                  isRefreshingSession ? 'animate-spin text-emerald-700' : ''
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between pt-1.5 border-t border-slate-100 text-[11px] text-slate-500">
            <span>Sisa Sesi:</span>
            <span
              className={`font-mono font-semibold ${
                remainingSessionSeconds <= 120
                  ? 'text-rose-700'
                  : 'text-slate-700'
              }`}
            >
              {formatCountdown(remainingSessionSeconds)}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between text-[11px] text-slate-500 px-0.5">
          <span className="flex items-center gap-1.5">
            {sseConnected ? (
              <Wifi className="h-3.5 w-3.5 text-emerald-700" />
            ) : (
              <WifiOff className="h-3.5 w-3.5 text-amber-600" />
            )}
            <span>{sseConnected ? 'Sinkronisasi Aktif' : 'Menghubungkan'}</span>
          </span>

          <button
            type="button"
            onClick={onLogout}
            className="inline-flex items-center gap-1 font-semibold text-rose-700 hover:text-rose-900"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Keluar</span>
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden lg:block lg:w-64 lg:shrink-0 lg:fixed lg:inset-y-0 lg:left-0 z-20">
        {sidebarBody}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/40"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <aside className="relative w-72 max-w-[85vw] h-full z-50">
            {sidebarBody}
          </aside>
        </div>
      )}
    </>
  );
}
