import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Copy,
  ExternalLink,
  MessageSquare,
  Send,
  SlidersHorizontal,
} from 'lucide-react';
import type {
  DepartmentMetrics,
  PermissionKey,
  PettyCashRequest,
  WhatsAppDispatchLog,
  WhatsAppModuleConfig,
} from '../types/pettycash.ts';
import { formatDateTime, formatIDR } from '../utils/formatters.ts';
import {
  buildLowBalanceWhatsAppMessage,
  buildRequestWhatsAppMessage,
  buildWhatsAppDeepLink,
  hasPermission,
  normalizeWhatsAppPhone,
} from '../utils/pettycashLogic.ts';

function safeWaHref(rawUrl: string): string | null {
  return /^https:\/\/wa\.me\/[0-9]+(\?.*)?$/.test(rawUrl) ? rawUrl : null;
}

interface WhatsAppViewProps {
  whatsappModule: WhatsAppModuleConfig;
  whatsappLogs: WhatsAppDispatchLog[];
  requests: PettyCashRequest[];
  metrics: DepartmentMetrics[];
  userPermissions: readonly PermissionKey[];
  onUpdateWhatsAppModule: (payload: {
    enabled?: boolean;
    directorPhone?: string;
    autoSendOnNewRequest?: boolean;
    autoSendOnDecision?: boolean;
    lowBalanceReminder?: boolean;
  }) => Promise<{ ok: boolean; error?: string }>;
  onDispatchWhatsApp: (payload: {
    eventType: 'new_request' | 'decision' | 'low_balance' | 'manual_test';
    referenceNumber: string;
    messagePreview: string;
    recipientPhone?: string;
  }) => Promise<{ ok: boolean; error?: string }>;
  onEnableModule: () => Promise<{ ok: boolean; error?: string }>;
  onNavigateModules: () => void;
}

export function WhatsAppView({
  whatsappModule,
  whatsappLogs,
  requests,
  metrics,
  userPermissions,
  onUpdateWhatsAppModule,
  onDispatchWhatsApp,
  onEnableModule,
  onNavigateModules,
}: WhatsAppViewProps) {
  const canManageModules = hasPermission(userPermissions, 'modules:manage');
  const canDispatch = hasPermission(userPermissions, 'whatsapp:dispatch');
  const [phoneInput, setPhoneInput] = useState(whatsappModule.directorPhone);
  const [saving, setSaving] = useState(false);
  const [dispatching, setDispatching] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [enabling, setEnabling] = useState(false);

  const [previewMode, setPreviewMode] = useState<'request' | 'low_balance'>(
    'request'
  );
  const [selectedRequestId, setSelectedRequestId] = useState(
    requests.find((r) => r.status === 'pending_director')?.id ??
      requests[0]?.id ??
      ''
  );

  useEffect(() => {
    setPhoneInput(whatsappModule.directorPhone);
  }, [whatsappModule.directorPhone]);

  const deptNameMap = useMemo(
    () => new Map(metrics.map((m) => [m.department.id, m.department.name])),
    [metrics]
  );

  const selectedRequest = useMemo(
    () => requests.find((r) => r.id === selectedRequestId) ?? requests[0],
    [requests, selectedRequestId]
  );

  const previewText = useMemo(() => {
    if (previewMode === 'low_balance' || !selectedRequest) {
      return buildLowBalanceWhatsAppMessage(metrics);
    }
    return buildRequestWhatsAppMessage({
      eventType:
        selectedRequest.status === 'pending_director'
          ? 'new_request'
          : 'decision',
      request: selectedRequest,
      departmentName:
        deptNameMap.get(selectedRequest.departmentId) ??
        selectedRequest.departmentId,
    });
  }, [previewMode, selectedRequest, metrics, deptNameMap]);

  const activePhone =
    normalizeWhatsAppPhone(phoneInput) || whatsappModule.directorPhone;
  const previewWaLink = safeWaHref(
    buildWhatsAppDeepLink(activePhone, previewText)
  );

  if (!whatsappModule.enabled) {
    return (
      <section className="bg-white border border-slate-200 rounded-xl p-8 text-center max-w-2xl mx-auto">
        <SlidersHorizontal className="h-8 w-8 text-slate-400 mx-auto mb-3" />
        <h2 className="text-lg font-semibold text-slate-900">
          Modul Notifikasi WhatsApp Sedang Nonaktif
        </h2>
        <p className="mt-2 text-sm text-slate-600 leading-relaxed">
          Aktifkan modul WhatsApp untuk mengirim ringkasan pengajuan petty cash
          baru, keputusan approval, serta peringatan saldo menipis langsung ke
          nomor WhatsApp Direktur.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {canManageModules && (
            <button
              type="button"
              disabled={enabling}
              onClick={async () => {
                setEnabling(true);
                await onEnableModule();
                setEnabling(false);
              }}
              className="rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
            >
              {enabling ? 'Mengaktifkan...' : 'Aktifkan Modul WhatsApp'}
            </button>
          )}
          <button
            type="button"
            onClick={onNavigateModules}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Kembali ke Pusat Modul
          </button>
        </div>
      </section>
    );
  }

  async function handleSavePhone(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);
    const res = await onUpdateWhatsAppModule({ directorPhone: phoneInput });
    setSaving(false);
    if (!res.ok) {
      setError(res.error || 'Gagal menyimpan nomor WhatsApp.');
    }
  }

  async function handleToggle(
    patch: Partial<{
      autoSendOnNewRequest: boolean;
      autoSendOnDecision: boolean;
      lowBalanceReminder: boolean;
    }>
  ) {
    setError('');
    setSaving(true);
    const res = await onUpdateWhatsAppModule(patch);
    setSaving(false);
    if (!res.ok) {
      setError(res.error || 'Gagal memperbarui aturan notifikasi.');
    }
  }

  async function handleSendDispatch() {
    setError('');
    setDispatching(true);
    const res = await onDispatchWhatsApp({
      eventType:
        previewMode === 'low_balance'
          ? 'low_balance'
          : selectedRequest?.status === 'pending_director'
          ? 'new_request'
          : 'decision',
      referenceNumber:
        previewMode === 'low_balance'
          ? 'SALDO-KAS'
          : selectedRequest?.requestNumber ?? 'UMUM',
      messagePreview: previewText,
      recipientPhone: activePhone,
    });
    setDispatching(false);
    if (!res.ok) {
      setError(res.error || 'Gagal mencatat pengiriman pesan WhatsApp.');
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(previewText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setError('Clipboard tidak tersedia pada browser ini.');
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Config & Trigger Controls */}
      <section className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className="xl:col-span-5 bg-white border border-slate-200 rounded-xl p-5 space-y-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-emerald-700" />
                <span>Konfigurasi WhatsApp Direktur</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Format pesan terstruktur untuk persetujuan cepat Direktur.
              </p>
            </div>
            <button
              type="button"
              onClick={onNavigateModules}
              className="text-xs font-semibold text-slate-600 hover:text-slate-900 hover:underline whitespace-nowrap"
            >
              Pusat Modul
            </button>
          </div>

          <form onSubmit={handleSavePhone} className="space-y-2">
            <label
              htmlFor="wa-director-phone"
              className="block text-xs font-semibold text-slate-700"
            >
              Nomor WhatsApp Direktur (08xx / 628xx)
            </label>
            <div className="flex items-center gap-2">
              <input
                id="wa-director-phone"
                type="text"
                disabled={!canManageModules}
                value={phoneInput}
                onChange={(e) => setPhoneInput(e.target.value)}
                placeholder="6281188990011"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono text-slate-900 focus:border-emerald-700 focus:outline-none disabled:bg-slate-100"
              />
              {canManageModules && (
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50 whitespace-nowrap"
                >
                  Simpan
                </button>
              )}
            </div>
            <p className="text-[11px] text-slate-500 font-mono">
              Aktif tersimpan: +{whatsappModule.directorPhone}
            </p>
          </form>

          <div className="space-y-2.5 pt-2 border-t border-slate-100">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Pemicu Otomatis
            </p>

            <label className="flex items-start gap-2.5 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={whatsappModule.autoSendOnNewRequest}
                disabled={saving || !canManageModules}
                onChange={(e) =>
                  handleToggle({ autoSendOnNewRequest: e.target.checked })
                }
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-700"
              />
              <span>
                <strong className="block text-slate-800">
                  Notifikasi Pengajuan Baru Masuk
                </strong>
                <span className="text-slate-500">
                  Otomatis antrekan ringkasan nota ke Direktur saat staf ajukan
                  kas kecil.
                </span>
              </span>
            </label>

            <label className="flex items-start gap-2.5 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={whatsappModule.autoSendOnDecision}
                disabled={saving || !canManageModules}
                onChange={(e) =>
                  handleToggle({ autoSendOnDecision: e.target.checked })
                }
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-700"
              />
              <span>
                <strong className="block text-slate-800">
                  Konfirmasi Keputusan Approval / Tolak
                </strong>
                <span className="text-slate-500">
                  Catat log notifikasi status pencairan setelah Direktur
                  memutus pengajuan.
                </span>
              </span>
            </label>

            <label className="flex items-start gap-2.5 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={whatsappModule.lowBalanceReminder}
                disabled={saving || !canManageModules}
                onChange={(e) =>
                  handleToggle({ lowBalanceReminder: e.target.checked })
                }
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-700"
              />
              <span>
                <strong className="block text-slate-800">
                  Peringatan Saldo Divisi Menipis
                </strong>
                <span className="text-slate-500">
                  Siapkan format laporan saldo di bawah ambang batas aman.
                </span>
              </span>
            </label>
          </div>

          {error && (
            <p className="text-xs font-medium text-rose-700" role="alert">
              {error}
            </p>
          )}
        </div>

        {/* Right: Live Message Composer & Preview */}
        <div className="xl:col-span-7 bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between space-y-4">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Pratinjau &amp; Kirim Pesan WhatsApp
                </h2>
                <p className="text-xs text-slate-500">
                  Pilih sumber pesan lalu salin, kirim via WhatsApp Web/App,
                  atau catat log pengiriman.
                </p>
              </div>
              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg text-xs">
                <button
                  type="button"
                  onClick={() => setPreviewMode('request')}
                  className={`px-3 py-1 rounded-md font-semibold transition-colors ${
                    previewMode === 'request'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Pengajuan
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewMode('low_balance')}
                  className={`px-3 py-1 rounded-md font-semibold transition-colors ${
                    previewMode === 'low_balance'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Saldo Menipis
                </button>
              </div>
            </div>

            {previewMode === 'request' && (
              <div>
                <label
                  htmlFor="wa-request-select"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Pilih Transaksi Pengajuan
                </label>
                <select
                  id="wa-request-select"
                  value={selectedRequest?.id ?? ''}
                  onChange={(e) => setSelectedRequestId(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-emerald-700 focus:outline-none"
                >
                  {requests.slice(0, 12).map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.requestNumber} · {r.requesterName} ·{' '}
                      {formatIDR(r.amount)} — {r.title}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <pre className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs font-mono text-slate-800 whitespace-pre-wrap leading-relaxed">
              {previewText}
            </pre>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                {copied ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-700" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                <span>{copied ? 'Tersalin!' : 'Salin Teks'}</span>
              </button>

              {previewWaLink && (
                <a
                  href={previewWaLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  <span>Buka wa.me</span>
                </a>
              )}
            </div>

            {canDispatch && (
              <button
                type="button"
                disabled={dispatching}
                onClick={handleSendDispatch}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
              >
                <Send className="h-3.5 w-3.5" />
                <span>
                  {dispatching ? 'Mengirim...' : 'Kirim & Catat Log Notifikasi'}
                </span>
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Dispatch Log History */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              Riwayat Log Notifikasi WhatsApp
            </h3>
            <p className="text-xs text-slate-500">
              Audit trail pengiriman pengajuan baru, keputusan approval, dan
              pengingat saldo.
            </p>
          </div>
          <span className="font-mono text-xs text-slate-500">
            {whatsappLogs.length} catatan
          </span>
        </div>

        {whatsappLogs.length === 0 ? (
          <p className="p-8 text-center text-xs text-slate-500">
            Belum ada notifikasi WhatsApp tercatat. Klik{' '}
            <strong>Kirim &amp; Catat Log Notifikasi</strong> atau buat
            pengajuan baru saat modul aktif.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold">
                  <th className="py-3 px-4">Waktu</th>
                  <th className="py-3 px-4">Referensi</th>
                  <th className="py-3 px-4">Tujuan</th>
                  <th className="py-3 px-4">Ringkasan Pesan</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {whatsappLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4 font-mono tabular-nums text-slate-600 whitespace-nowrap">
                      {formatDateTime(log.createdAt)}
                    </td>
                    <td className="py-3 px-4 font-mono font-semibold text-slate-800 whitespace-nowrap">
                      {log.referenceNumber}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-700 whitespace-nowrap">
                      +{log.recipientPhone}
                    </td>
                    <td className="py-3 px-4 text-slate-600 max-w-md truncate">
                      {log.messagePreview.split('\n').slice(0, 2).join(' · ')}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span
                        className={`font-semibold ${
                          log.status === 'sent'
                            ? 'text-emerald-700'
                            : 'text-amber-700'
                        }`}
                      >
                        {log.status === 'sent' ? 'Terkirim' : 'Antrean Auto'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      {safeWaHref(log.waLink) ? (
                        <a
                          href={safeWaHref(log.waLink) ?? undefined}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-semibold text-emerald-700 hover:underline"
                        >
                          Buka WA →
                        </a>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
