import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import type {
  DepartmentMetrics,
  ExpenseCategory,
  FraudFlag,
  FraudGuardConfig,
  MasterCategory,
  MasterEmployee,
  MasterVehicle,
  PettyCashRequest,
  TaxModuleConfig,
  TaxSchemeId,
} from '../../types/pettycash.ts';
import {
  formatIDR,
  formatNumberInput,
  normalizeRefCode,
  parseFormattedNumber,
} from '../../utils/formatters.ts';
import {
  calculateIndonesianTax,
  evaluateFraudGuards,
  TAX_SCHEMES,
} from '../../utils/pettycashLogic.ts';
import {
  ReceiptUploader,
  type UploadedReceiptImage,
} from '../common/ReceiptUploader.tsx';

export interface NewRequestModalProps {
  open: boolean;
  metrics: DepartmentMetrics[];
  employees: MasterEmployee[];
  categories: MasterCategory[];
  vehicles: MasterVehicle[];
  existingRequests: PettyCashRequest[];
  taxModule: TaxModuleConfig;
  fraudGuard: FraudGuardConfig;
  onClose: () => void;
  onSubmit: (payload: {
    departmentId: string;
    employeeId?: string;
    requesterName: string;
    title: string;
    category: ExpenseCategory;
    vehicleId?: string;
    amount: number;
    taxType?: TaxSchemeId;
    notes: string;
    receiptRef: string;
    receiptImageUrl?: string;
    receiptImageName?: string;
  }) => Promise<{ ok: boolean; error?: string }>;
}

export function NewRequestModal({
  open,
  metrics,
  employees,
  categories,
  vehicles,
  existingRequests,
  taxModule,
  fraudGuard,
  onClose,
  onSubmit,
}: NewRequestModalProps) {
  const activeMetrics = useMemo(
    () => metrics.filter((m) => m.department.active !== false),
    [metrics]
  );
  const activeEmployees = useMemo(
    () => employees.filter((e) => e.active),
    [employees]
  );
  const activeCategories = useMemo(
    () => categories.filter((c) => c.active),
    [categories]
  );
  const activeVehicles = useMemo(
    () => vehicles.filter((v) => v.active),
    [vehicles]
  );

  const allowedTaxSchemes = useMemo(() => {
    return TAX_SCHEMES.filter((scheme) => {
      if (scheme.group === 'none') return true;
      if (scheme.group === 'ppn') return taxModule.enablePpn;
      if (scheme.group === 'pph23') return taxModule.enablePph23;
      if (scheme.group === 'pph21') return taxModule.enablePph21;
      return false;
    });
  }, [taxModule.enablePpn, taxModule.enablePph23, taxModule.enablePph21]);

  const [employeeId, setEmployeeId] = useState(activeEmployees[0]?.id ?? '');
  const [departmentId, setDepartmentId] = useState(
    activeEmployees[0]?.departmentId ?? activeMetrics[0]?.department.id ?? ''
  );
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>(
    activeCategories[0]?.name ?? 'BBM & Tol Armada'
  );
  const [vehicleId, setVehicleId] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [taxType, setTaxType] = useState<TaxSchemeId>('none');
  const [receiptRef, setReceiptRef] = useState('');
  const [notes, setNotes] = useState('');
  const [uploadedImage, setUploadedImage] =
    useState<UploadedReceiptImage | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const parsedAmount = parseFormattedNumber(amountStr);
  const taxPreview = useMemo(() => {
    if (!taxModule.enabled || taxType === 'none' || parsedAmount <= 0) {
      return null;
    }
    return calculateIndonesianTax(parsedAmount, taxType);
  }, [taxModule.enabled, taxType, parsedAmount]);

  const effectiveAmount = taxPreview?.netDisbursed ?? parsedAmount;
  const selectedEmployee = activeEmployees.find((e) => e.id === employeeId);

  const liveFraudCheck = useMemo(() => {
    if (!fraudGuard.enabled || !selectedEmployee) {
      return { blockingErrors: [] as string[], warnings: [] as FraudFlag[] };
    }
    return evaluateFraudGuards(
      {
        departmentId,
        requesterName: selectedEmployee.name,
        category,
        vehicleId: vehicleId || undefined,
        amount: effectiveAmount,
        receiptRef: normalizeRefCode(receiptRef),
        receiptImageUrl: uploadedImage?.url,
      },
      fraudGuard,
      existingRequests,
      categories,
      new Date().toISOString()
    );
  }, [
    fraudGuard,
    selectedEmployee,
    departmentId,
    category,
    vehicleId,
    effectiveAmount,
    receiptRef,
    uploadedImage?.url,
    existingRequests,
    categories,
  ]);

  useEffect(() => {
    if (!open) return;
    if (
      activeEmployees.length > 0 &&
      !activeEmployees.some((e) => e.id === employeeId)
    ) {
      const firstEmp = activeEmployees[0];
      setEmployeeId(firstEmp.id);
      if (activeMetrics.some((m) => m.department.id === firstEmp.departmentId)) {
        setDepartmentId(firstEmp.departmentId);
      }
    }
    if (
      activeMetrics.length > 0 &&
      !activeMetrics.some((m) => m.department.id === departmentId)
    ) {
      setDepartmentId(activeMetrics[0].department.id);
    }
    if (
      activeCategories.length > 0 &&
      !activeCategories.some((c) => c.name === category)
    ) {
      setCategory(activeCategories[0].name);
    }
    if (
      !taxModule.enabled ||
      !allowedTaxSchemes.some((s) => s.id === taxType)
    ) {
      setTaxType('none');
    }
  }, [
    open,
    activeEmployees,
    activeMetrics,
    activeCategories,
    employeeId,
    departmentId,
    category,
    taxModule.enabled,
    allowedTaxSchemes,
    taxType,
  ]);

  if (!open) return null;

  const selectedMetric =
    activeMetrics.find((m) => m.department.id === departmentId) ??
    activeMetrics[0];
  const selectedCategoryObj = activeCategories.find((c) => c.name === category);
  const deptMap = new Map(
    metrics.map((m) => [m.department.id, m.department])
  );
  const isPhotoRequired =
    fraudGuard.enabled &&
    fraudGuard.requireReceiptImage &&
    (effectiveAmount <= 0 ||
      effectiveAmount >= fraudGuard.receiptRequiredMinAmount);

  function handleEmployeeChange(nextEmpId: string) {
    setEmployeeId(nextEmpId);
    const emp = activeEmployees.find((e) => e.id === nextEmpId);
    if (
      emp &&
      activeMetrics.some((m) => m.department.id === emp.departmentId)
    ) {
      setDepartmentId(emp.departmentId);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!selectedEmployee) {
      setError('Silakan pilih karyawan pemohon dari Data Master terlebih dahulu.');
      return;
    }
    setSubmitting(true);
    const res = await onSubmit({
      departmentId,
      employeeId: selectedEmployee.id,
      requesterName: selectedEmployee.name,
      title,
      category,
      vehicleId: vehicleId || undefined,
      amount: parseFormattedNumber(amountStr),
      taxType: taxModule.enabled ? taxType : 'none',
      notes,
      receiptRef: normalizeRefCode(receiptRef),
      receiptImageUrl: uploadedImage?.url,
      receiptImageName: uploadedImage?.name,
    });
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error || 'Gagal mengirim pengajuan.');
      return;
    }
    setTitle('');
    setAmountStr('');
    setTaxType('none');
    setNotes('');
    setReceiptRef('');
    setVehicleId('');
    setUploadedImage(null);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-request-title"
    >
      <div className="w-full max-w-3xl rounded-xl bg-white border border-slate-200 shadow-xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2
              id="new-request-title"
              className="text-base font-semibold text-slate-900"
            >
              Ajukan Pengeluaran Petty Cash
            </h2>
            <p className="text-xs text-slate-500">
              Pengajuan langsung diteruskan ke Direktur untuk persetujuan (1
              tahap).
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup form pengajuan"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="req-employee"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Pemohon (Master Karyawan)
              </label>
              <select
                id="req-employee"
                value={employeeId}
                onChange={(e) => handleEmployeeChange(e.target.value)}
                required
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-700 focus:outline-none"
              >
                {activeEmployees.length === 0 ? (
                  <option value="">Belum ada karyawan aktif</option>
                ) : (
                  activeEmployees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} — {emp.roleTitle}
                    </option>
                  ))
                )}
              </select>
              {selectedEmployee && (
                <p className="mt-1 text-xs text-slate-500">
                  Kode {selectedEmployee.code} ·{' '}
                  {deptMap.get(selectedEmployee.departmentId)?.name ??
                    selectedEmployee.departmentId}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="req-dept"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Divisi Pembebanan Saldo
              </label>
              <select
                id="req-dept"
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
                required
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-700 focus:outline-none"
              >
                {activeMetrics.map((m) => (
                  <option key={m.department.id} value={m.department.id}>
                    {m.department.code} — {m.department.name}
                  </option>
                ))}
              </select>
              {selectedMetric && (
                <p className="mt-1 text-xs text-slate-500 font-mono tabular-nums">
                  Tersedia: {formatIDR(selectedMetric.availableBalance)} · PIC:{' '}
                  {selectedMetric.department.picName}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="req-category"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Kategori Pengeluaran
              </label>
              <select
                id="req-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-700 focus:outline-none"
              >
                {activeCategories.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="req-amount"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Nominal Pengajuan (IDR)
              </label>
              <input
                id="req-amount"
                type="text"
                inputMode="numeric"
                value={amountStr}
                onChange={(e) =>
                  setAmountStr(formatNumberInput(e.target.value))
                }
                placeholder="500.000"
                required
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono tabular-nums text-slate-900 focus:border-emerald-700 focus:outline-none"
              />
            </div>
          </div>

          {taxModule.enabled && (
            <div className="space-y-2.5">
              <div>
                <label
                  htmlFor="req-tax-type"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Skema Pajak Indonesia (Modul Pajak Aktif)
                </label>
                <select
                  id="req-tax-type"
                  value={taxType}
                  onChange={(e) => setTaxType(e.target.value as TaxSchemeId)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-700 focus:outline-none"
                >
                  {allowedTaxSchemes.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>

              {taxPreview && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs space-y-1.5">
                  <div className="flex items-center justify-between text-slate-600">
                    <span>Dasar Pengenaan Pajak (DPP)</span>
                    <span className="font-mono tabular-nums text-slate-800">
                      {formatIDR(taxPreview.dppAmount)}
                    </span>
                  </div>
                  {taxPreview.ppnAmount > 0 && (
                    <div className="flex items-center justify-between text-emerald-700">
                      <span>PPN Masukan (11%)</span>
                      <span className="font-mono tabular-nums">
                        +{formatIDR(taxPreview.ppnAmount)}
                      </span>
                    </div>
                  )}
                  {taxPreview.pphAmount > 0 && (
                    <div className="flex items-center justify-between text-amber-700">
                      <span>Potongan {taxPreview.label}</span>
                      <span className="font-mono tabular-nums">
                        -{formatIDR(taxPreview.pphAmount)}
                      </span>
                    </div>
                  )}
                  <div className="pt-1.5 border-t border-slate-200 flex items-center justify-between font-semibold text-slate-900">
                    <span>Total Kas Keluar (Dicairkan)</span>
                    <span className="font-mono tabular-nums">
                      {formatIDR(taxPreview.netDisbursed)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          <div>
            <label
              htmlFor="req-title"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              Judul Keperluan
            </label>
            <input
              id="req-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Contoh: Uang Jalan & Tol Truk Wingbox Rute Surabaya"
              required
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-emerald-700 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="req-vehicle"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Unit Armada / No. Polisi{' '}
                {selectedCategoryObj?.requiresVehicle
                  ? '(Disarankan)'
                  : '(Opsional)'}
              </label>
              <select
                id="req-vehicle"
                value={vehicleId}
                onChange={(e) => setVehicleId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-700 focus:outline-none"
              >
                <option value="">Tidak terkait armada (Non-unit)</option>
                {activeVehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.plateNumber} — {v.unitType}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="req-ref"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                No. Surat Jalan / Nota (Opsional)
              </label>
              <input
                id="req-ref"
                type="text"
                value={receiptRef}
                onChange={(e) =>
                  setReceiptRef(e.target.value.toUpperCase())
                }
                onBlur={() => setReceiptRef(normalizeRefCode(receiptRef))}
                placeholder="SJ-KRG-2026-..."
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono uppercase text-slate-900 focus:border-emerald-700 focus:outline-none"
              />
            </div>
          </div>

          <ReceiptUploader
            inputId="req-receipt-file"
            labelText="Unggah Foto Nota / Invoice / Struk"
            isRequired={isPhotoRequired}
            value={uploadedImage}
            onChange={setUploadedImage}
            onError={setError}
            onUploadingChange={setUploadingImage}
            idleTitle="Pilih foto nota, invoice, atau struk tol/BBM"
            uploadingText="Mengunggah gambar nota..."
            helperText="Membantu Direktur memverifikasi bukti pengeluaran"
            requiredHelperText="Wajib dilampirkan sebelum dikirim agar bebas nota fiktif"
            readyText="Gambar nota siap dilampirkan"
          />

          <div>
            <label
              htmlFor="req-notes"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              Catatan Tambahan (Opsional)
            </label>
            <input
              id="req-notes"
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Rute pengiriman, nomor polisi truk, atau keterangan lainnya"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-emerald-700 focus:outline-none"
            />
          </div>

          {fraudGuard.enabled &&
            effectiveAmount > 0 &&
            (liveFraudCheck.blockingErrors.some(
              (msg) => !msg.includes('Foto nota/invoice wajib')
            ) ||
              liveFraudCheck.warnings.length > 0) && (
              <div className="rounded-lg border border-amber-200 bg-amber-50/80 p-3 text-xs text-amber-900 space-y-1">
                <p className="font-semibold flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-700 shrink-0" />
                  <span>Deteksi Awal Guard Anti-Fraud</span>
                </p>
                {liveFraudCheck.blockingErrors
                  .filter((msg) => !msg.includes('Foto nota/invoice wajib'))
                  .map((msg) => (
                    <p key={msg} className="text-rose-700 font-medium">
                      • {msg}
                    </p>
                  ))}
                {liveFraudCheck.warnings.map((w) => (
                  <p key={w.code}>
                    • <strong>{w.title}:</strong> {w.detail}
                  </p>
                ))}
              </div>
            )}

          {error && (
            <p className="text-xs font-medium text-rose-700" role="alert">
              {error}
            </p>
          )}

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={submitting || uploadingImage}
              className="rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
            >
              {submitting ? 'Mengirim...' : 'Kirim ke Direktur'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
