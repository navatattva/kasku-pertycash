import { useEffect, useMemo, useState } from 'react';
import { ShieldAlert, X } from 'lucide-react';
import type {
  DepartmentMetrics,
  DownPaymentRecord,
  MasterCategory,
  MasterEmployee,
  MasterVehicle,
} from '../../types/pettycash.ts';
import {
  formatIDR,
  formatNumberInput,
  parseFormattedNumber,
} from '../../utils/formatters.ts';
import {
  addDaysIso,
  DP_STATUS_LABELS,
  type CreateDownPaymentFn,
} from './dpShared.ts';

interface CreateKasbonModalProps {
  open: boolean;
  metrics: DepartmentMetrics[];
  employees: MasterEmployee[];
  categories: MasterCategory[];
  vehicles: MasterVehicle[];
  existingDownPayments: DownPaymentRecord[];
  todayDate: string;
  onClose: () => void;
  onSubmit: CreateDownPaymentFn;
}

export function CreateKasbonModal({
  open,
  metrics,
  employees,
  categories,
  vehicles,
  existingDownPayments,
  todayDate,
  onClose,
  onSubmit,
}: CreateKasbonModalProps) {
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

  const [employeeId, setEmployeeId] = useState(activeEmployees[0]?.id ?? '');
  const [departmentId, setDepartmentId] = useState(
    activeEmployees[0]?.departmentId ?? activeMetrics[0]?.department.id ?? ''
  );
  const [category, setCategory] = useState(
    activeCategories[0]?.name ?? 'BBM & Tol Armada'
  );
  const [vehicleId, setVehicleId] = useState('');
  const [title, setTitle] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [dueDate, setDueDate] = useState(() => addDaysIso(todayDate, 3));
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDueDate(addDaysIso(todayDate, 3));
    if (
      activeEmployees.length > 0 &&
      !activeEmployees.some((e) => e.id === employeeId)
    ) {
      setEmployeeId(activeEmployees[0].id);
      setDepartmentId(activeEmployees[0].departmentId);
    }
  }, [open, todayDate, activeEmployees, employeeId]);

  if (!open) return null;

  const selectedEmployee = activeEmployees.find((e) => e.id === employeeId);
  const selectedMetric =
    activeMetrics.find((m) => m.department.id === departmentId) ??
    activeMetrics[0];

  const activeKasbonForEmployee = selectedEmployee
    ? existingDownPayments.find(
        (dp) =>
          (dp.status === 'open' || dp.status === 'pending_director') &&
          (dp.employeeId === selectedEmployee.id ||
            dp.requesterName.toLowerCase() ===
              selectedEmployee.name.toLowerCase())
      )
    : undefined;

  function handleEmployeeChange(nextId: string) {
    setEmployeeId(nextId);
    setError('');
    const emp = activeEmployees.find((e) => e.id === nextId);
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
      setError('Silakan pilih karyawan pemohon.');
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
      requestedAmount: parseFormattedNumber(amountStr),
      dueDate,
      notes,
    });
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error || 'Gagal mengajukan kasbon.');
      return;
    }
    setTitle('');
    setAmountStr('');
    setVehicleId('');
    setNotes('');
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-kasbon-title"
    >
      <div className="w-full max-w-lg rounded-xl bg-white border border-slate-200 shadow-xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2
              id="create-kasbon-title"
              className="text-base font-semibold text-slate-900"
            >
              Ajukan Kasbon / Uang Muka Operasional
            </h2>
            <p className="text-xs text-slate-500">
              Uang muka sementara sebelum nota asli terkumpul; wajib realisasi
              sebelum batas jatuh tempo.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup form kasbon"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="kasbon-employee"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Pemohon Kasbon
              </label>
              <select
                id="kasbon-employee"
                value={employeeId}
                onChange={(e) => handleEmployeeChange(e.target.value)}
                required
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-700 focus:outline-none"
              >
                {activeEmployees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} — {emp.roleTitle}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="kasbon-dept"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Divisi Sumber Kas
              </label>
              <select
                id="kasbon-dept"
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
                  Saldo tersedia: {formatIDR(selectedMetric.availableBalance)}
                </p>
              )}
            </div>
          </div>

          {activeKasbonForEmployee && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 flex items-start gap-2">
              <ShieldAlert className="h-4 w-4 text-rose-700 shrink-0 mt-0.5" />
              <span>
                <strong>Kontrol Anti-Tunggakan:</strong>{' '}
                {selectedEmployee?.name} masih memiliki kasbon{' '}
                <strong className="font-mono">
                  {activeKasbonForEmployee.dpNumber}
                </strong>{' '}
                ({DP_STATUS_LABELS[activeKasbonForEmployee.status]}).
                Pengajuan kasbon kedua akan ditolak sistem sebelum kasbon aktif
                direalisasikan.
              </span>
            </div>
          )}

          <div>
            <label
              htmlFor="kasbon-title"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              Keperluan Uang Muka
            </label>
            <input
              id="kasbon-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Contoh: Uang Muka Bongkar Kontainer & Tol Rute Semarang"
              required
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-emerald-700 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="kasbon-category"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Kategori Biaya
              </label>
              <select
                id="kasbon-category"
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
                htmlFor="kasbon-vehicle"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Unit Armada (Opsional)
              </label>
              <select
                id="kasbon-vehicle"
                value={vehicleId}
                onChange={(e) => setVehicleId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-700 focus:outline-none"
              >
                <option value="">Non-unit / Umum</option>
                {activeVehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.plateNumber} — {v.unitType}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="kasbon-amount"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Nominal Uang Muka (IDR)
              </label>
              <input
                id="kasbon-amount"
                type="text"
                inputMode="numeric"
                value={amountStr}
                onChange={(e) =>
                  setAmountStr(formatNumberInput(e.target.value))
                }
                placeholder="1.500.000"
                required
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono tabular-nums text-slate-900 focus:border-emerald-700 focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="kasbon-due-date"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Batas Tanggal Realisasi Struk
              </label>
              <input
                id="kasbon-due-date"
                type="date"
                value={dueDate}
                min={todayDate}
                onChange={(e) => setDueDate(e.target.value)}
                required
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono text-slate-900 focus:border-emerald-700 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="kasbon-notes"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              Catatan Tambahan (Opsional)
            </label>
            <input
              id="kasbon-notes"
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Rincian estimasi biaya atau rencana setor struk"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-emerald-700 focus:outline-none"
            />
          </div>

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
              disabled={submitting}
              className="rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
            >
              {submitting ? 'Mengirim...' : 'Kirim Pengajuan Kasbon'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
