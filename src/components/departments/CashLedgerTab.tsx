import { Download, Image as ImageIcon } from 'lucide-react';
import type {
  CashLedgerSummary,
  Department,
  DownPaymentRecord,
  PettyCashRequest,
} from '../../types/pettycash.ts';
import {
  formatIDR,
  formatMonthLabel,
  formatShortDate,
} from '../../utils/formatters.ts';

interface CashLedgerTabProps {
  departments: Department[];
  ledgerDeptId: string;
  onLedgerDeptIdChange: (id: string) => void;
  ledgerMonth: string;
  onLedgerMonthChange: (month: string) => void;
  ledgerMonths: string[];
  cashLedger: CashLedgerSummary;
  requestById: Map<string, PettyCashRequest>;
  downPaymentById: Map<string, DownPaymentRecord>;
  canExport: boolean;
  onDownloadCsv: () => void;
  onPreviewReceipt: (request: PettyCashRequest) => void;
}

export function CashLedgerTab({
  departments,
  ledgerDeptId,
  onLedgerDeptIdChange,
  ledgerMonth,
  onLedgerMonthChange,
  ledgerMonths,
  cashLedger,
  requestById,
  downPaymentById,
  canExport,
  onDownloadCsv,
  onPreviewReceipt,
}: CashLedgerTabProps) {
  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <label
              htmlFor="ledger-dept-select"
              className="block text-xs font-medium text-slate-500 mb-1"
            >
              Divisi Kas Kecil
            </label>
            <select
              id="ledger-dept-select"
              value={ledgerDeptId}
              onChange={(e) => onLedgerDeptIdChange(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-900 focus:border-emerald-700 focus:outline-none"
            >
              <option value="all">Semua Divisi (Konsolidasi)</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.code} — {d.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="ledger-month-select"
              className="block text-xs font-medium text-slate-500 mb-1"
            >
              Periode Mutasi
            </label>
            <select
              id="ledger-month-select"
              value={ledgerMonth}
              onChange={(e) => onLedgerMonthChange(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-900 focus:border-emerald-700 focus:outline-none"
            >
              <option value="all">Semua Periode Tercatat</option>
              {ledgerMonths.map((m) => (
                <option key={m} value={m}>
                  {formatMonthLabel(m)} ({m})
                </option>
              ))}
            </select>
          </div>
        </div>

        {canExport && (
          <button
            type="button"
            onClick={onDownloadCsv}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-800 whitespace-nowrap shrink-0"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Unduh CSV Mutasi</span>
          </button>
        )}
      </div>

      {/* Ledger Summary Strip */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div>
          <p className="text-xs text-slate-500">Saldo Awal Periode</p>
          <p className="mt-1 font-mono tabular-nums text-lg font-semibold text-slate-900">
            {formatIDR(cashLedger.openingBalance)}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Total Kas Masuk (Debit)</p>
          <p className="mt-1 font-mono tabular-nums text-lg font-semibold text-emerald-700">
            +{formatIDR(cashLedger.totalInflow)}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Total Kas Keluar (Kredit)</p>
          <p className="mt-1 font-mono tabular-nums text-lg font-semibold text-rose-700">
            -{formatIDR(cashLedger.totalOutflow)}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Saldo Akhir (Buku)</p>
          <p className="mt-1 font-mono tabular-nums text-lg font-semibold text-slate-900">
            {formatIDR(cashLedger.closingBalance)}
          </p>
        </div>
      </div>

      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Buku Mutasi Kas Kronologis ({cashLedger.entries.length} transaksi)
            </h2>
            <p className="text-xs text-slate-500">
              Menampilkan mutasi masuk (Top-Up) dan keluar (pencairan disetujui)
              beserta saldo berjalan.
            </p>
          </div>
        </div>

        {cashLedger.entries.length === 0 ? (
          <p className="py-12 text-center text-sm text-slate-500">
            Belum ada mutasi kas pada cakupan divisi/periode ini.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold">
                  <th className="py-3 px-2.5 whitespace-nowrap">Tanggal</th>
                  <th className="py-3 px-2.5 whitespace-nowrap">Referensi</th>
                  <th className="py-3 px-2.5">Divisi</th>
                  <th className="py-3 px-2.5">Uraian Mutasi</th>
                  <th className="py-3 px-2.5">Pelaku / PIC</th>
                  <th className="py-3 px-2.5 text-right whitespace-nowrap">
                    Masuk (Debit)
                  </th>
                  <th className="py-3 px-2.5 text-right whitespace-nowrap">
                    Keluar (Kredit)
                  </th>
                  <th className="py-3 px-2.5 text-right whitespace-nowrap">
                    Saldo Berjalan
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {cashLedger.entries.map((entry) => {
                  const reqObj =
                    entry.type === 'disbursement'
                      ? requestById.get(entry.id.replace(/^req-/, ''))
                      : undefined;
                  const dpObj = entry.type.startsWith('kasbon')
                    ? downPaymentById.get(
                        entry.id.replace(/^dp-(out|ref|rem)-/, '')
                      )
                    : undefined;
                  const kasbonTag =
                    entry.type === 'kasbon_out'
                      ? 'KASBON KELUAR'
                      : entry.type === 'kasbon_refund'
                      ? 'SISA KASBON'
                      : entry.type === 'kasbon_reimburse'
                      ? 'KURANG BAYAR'
                      : null;
                  return (
                    <tr key={entry.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-2.5 font-mono tabular-nums text-slate-600 whitespace-nowrap">
                        {formatShortDate(entry.date)}
                      </td>
                      <td className="py-3 px-2.5 font-mono font-semibold text-slate-800 whitespace-nowrap">
                        {entry.referenceNumber}
                      </td>
                      <td className="py-3 px-2.5 text-slate-700 max-w-[140px]">
                        {entry.departmentName}
                      </td>
                      <td className="py-3 px-2.5 max-w-[260px]">
                        <p className="font-medium text-slate-900">
                          {entry.description}
                        </p>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-slate-500 mt-0.5">
                          <span>
                            {kasbonTag && (
                              <span className="font-mono text-[10px] font-semibold text-slate-600">
                                {kasbonTag} ·{' '}
                              </span>
                            )}
                            {entry.categoryOrSource}
                          </span>
                          {reqObj?.receiptImageUrl && (
                            <button
                              type="button"
                              onClick={() => onPreviewReceipt(reqObj)}
                              aria-label={`Lihat Nota ${reqObj.requestNumber}`}
                              className="inline-flex items-center gap-1 font-semibold text-emerald-700 hover:underline whitespace-nowrap"
                            >
                              <ImageIcon className="h-3 w-3" />
                              <span>Lihat Nota</span>
                            </button>
                          )}
                          {!reqObj &&
                            dpObj?.settlement?.receiptImageUrl &&
                            (entry.type !== 'kasbon_out' ||
                              dpObj.settlement.differenceType === 'exact') && (
                              <button
                                type="button"
                                onClick={() =>
                                  onPreviewReceipt({
                                    id: dpObj.id,
                                    requestNumber: dpObj.dpNumber,
                                    departmentId: dpObj.departmentId,
                                    requesterName: dpObj.requesterName,
                                    title: dpObj.title,
                                    category: dpObj.category,
                                    amount: dpObj.settlement!.actualAmount,
                                    notes: dpObj.settlement!.note,
                                    receiptRef: dpObj.settlement!.receiptRef,
                                    receiptImageUrl:
                                      dpObj.settlement!.receiptImageUrl,
                                    receiptImageName:
                                      dpObj.settlement!.receiptImageName,
                                    status: 'approved',
                                    approval: dpObj.approval,
                                    createdAt: dpObj.createdAt,
                                    updatedAt: dpObj.updatedAt,
                                  })
                                }
                                aria-label={`Lihat Struk ${dpObj.dpNumber}`}
                                className="inline-flex items-center gap-1 font-semibold text-emerald-700 hover:underline whitespace-nowrap"
                              >
                                <ImageIcon className="h-3 w-3" />
                                <span>Lihat Struk</span>
                              </button>
                            )}
                        </div>
                      </td>
                      <td className="py-3 px-2.5 text-slate-700 max-w-[120px]">
                        {entry.actor}
                      </td>
                      <td className="py-3 px-2.5 text-right font-mono tabular-nums font-semibold text-emerald-700 whitespace-nowrap">
                        {entry.debit > 0 ? `+${formatIDR(entry.debit)}` : '-'}
                      </td>
                      <td className="py-3 px-2.5 text-right font-mono tabular-nums font-semibold text-rose-700 whitespace-nowrap">
                        {entry.credit > 0 ? `-${formatIDR(entry.credit)}` : '-'}
                      </td>
                      <td className="py-3 px-2.5 text-right font-mono tabular-nums font-semibold text-slate-900 whitespace-nowrap">
                        {formatIDR(entry.runningBalance)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
