import { useState } from 'react';
import type { Department } from '../../types/pettycash.ts';

interface EditDepartmentModalProps {
  department: Department | null;
  onClose: () => void;
  onSave: (payload: {
    departmentId: string;
    picName: string;
    monthlyBudget: number;
    lowBalanceThreshold: number;
  }) => Promise<{ ok: boolean; error?: string }>;
}

export function EditDepartmentModal({
  department,
  onClose,
  onSave,
}: EditDepartmentModalProps) {
  const [picName, setPicName] = useState(department?.picName ?? '');
  const [monthlyBudget, setMonthlyBudget] = useState(
    department ? String(department.monthlyBudget) : ''
  );
  const [lowThreshold, setLowThreshold] = useState(
    department ? String(department.lowBalanceThreshold) : ''
  );
  const [editError, setEditError] = useState('');
  const [saving, setSaving] = useState(false);

  if (!department) return null;

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!department) return;
    setSaving(true);
    setEditError('');
    const result = await onSave({
      departmentId: department.id,
      picName,
      monthlyBudget: Number(monthlyBudget),
      lowBalanceThreshold: Number(lowThreshold),
    });
    setSaving(false);
    if (!result.ok) {
      setEditError(result.error || 'Gagal menyimpan perubahan divisi.');
      return;
    }
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-dept-title"
    >
      <div className="w-full max-w-md rounded-xl bg-white border border-slate-200 p-6 shadow-xl">
        <h3
          id="edit-dept-title"
          className="text-lg font-semibold text-slate-900"
        >
          Pengaturan Divisi {department.name}
        </h3>
        <p className="mt-1 text-xs text-slate-500">
          Perbarui nama penanggung jawab (PIC) serta batas plafon anggaran
          bulanan.
        </p>

        <form onSubmit={handleSaveEdit} className="mt-4 space-y-4">
          <div>
            <label
              htmlFor="edit-pic-name"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              Nama Penanggung Jawab (PIC)
            </label>
            <input
              id="edit-pic-name"
              type="text"
              value={picName}
              onChange={(e) => setPicName(e.target.value)}
              required
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-emerald-700 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="edit-budget"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Plafon Bulanan (IDR)
              </label>
              <input
                id="edit-budget"
                type="number"
                min={100000}
                step={50000}
                value={monthlyBudget}
                onChange={(e) => setMonthlyBudget(e.target.value)}
                required
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono tabular-nums text-slate-900 focus:border-emerald-700 focus:outline-none"
              />
            </div>
            <div>
              <label
                htmlFor="edit-threshold"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Batas Peringatan (IDR)
              </label>
              <input
                id="edit-threshold"
                type="number"
                min={0}
                step={50000}
                value={lowThreshold}
                onChange={(e) => setLowThreshold(e.target.value)}
                required
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono tabular-nums text-slate-900 focus:border-emerald-700 focus:outline-none"
              />
            </div>
          </div>

          {editError && (
            <p className="text-xs font-medium text-rose-700">{editError}</p>
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
              disabled={saving}
              className="rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
            >
              {saving ? 'Menyimpan...' : 'Simpan Pengaturan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
