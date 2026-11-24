import { useState } from 'react';
import { X } from 'lucide-react';
import type { Department } from '../../types/pettycash.ts';
import {
  formatNumberInput,
  normalizeCode,
  normalizePersonName,
  normalizePlateNumber,
  parseFormattedNumber,
} from '../../utils/formatters.ts';
import type {
  MasterDataCallbacks,
  MasterModalState,
} from './masterShared.ts';

interface MasterFormModalProps extends MasterDataCallbacks {
  modal: NonNullable<MasterModalState>;
  departments: Department[];
  onClose: () => void;
}

export function MasterFormModal({
  modal,
  departments,
  onClose,
  onCreateDepartment,
  onUpdateDepartment,
  onCreateEmployee,
  onUpdateEmployee,
  onCreateCategory,
  onUpdateCategory,
  onCreateVehicle,
  onUpdateVehicle,
}: MasterFormModalProps) {
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // Department fields
  const [deptCode, setDeptCode] = useState(
    modal.kind === 'department' && modal.editing ? modal.editing.code : ''
  );
  const [deptName, setDeptName] = useState(
    modal.kind === 'department' && modal.editing ? modal.editing.name : ''
  );
  const [deptPic, setDeptPic] = useState(
    modal.kind === 'department' && modal.editing ? modal.editing.picName : ''
  );
  const [deptBudgetStr, setDeptBudgetStr] = useState(
    modal.kind === 'department' && modal.editing
      ? formatNumberInput(modal.editing.monthlyBudget)
      : '10.000.000'
  );
  const [deptThresholdStr, setDeptThresholdStr] = useState(
    modal.kind === 'department' && modal.editing
      ? formatNumberInput(modal.editing.lowBalanceThreshold)
      : '2.000.000'
  );
  const [deptInitialBalanceStr, setDeptInitialBalanceStr] =
    useState('5.000.000');

  // Employee fields
  const [empCode, setEmpCode] = useState(
    modal.kind === 'employee' && modal.editing ? modal.editing.code : ''
  );
  const [empName, setEmpName] = useState(
    modal.kind === 'employee' && modal.editing ? modal.editing.name : ''
  );
  const [empRoleTitle, setEmpRoleTitle] = useState(
    modal.kind === 'employee' && modal.editing ? modal.editing.roleTitle : ''
  );
  const [empDeptId, setEmpDeptId] = useState(
    modal.kind === 'employee' && modal.editing
      ? modal.editing.departmentId
      : departments[0]?.id ?? ''
  );

  // Category fields
  const [catCode, setCatCode] = useState(
    modal.kind === 'category' && modal.editing ? modal.editing.code : ''
  );
  const [catName, setCatName] = useState(
    modal.kind === 'category' && modal.editing ? modal.editing.name : ''
  );
  const [catRequiresVehicle, setCatRequiresVehicle] = useState(
    modal.kind === 'category' && modal.editing
      ? modal.editing.requiresVehicle
      : false
  );

  // Vehicle fields
  const [vehPlate, setVehPlate] = useState(
    modal.kind === 'vehicle' && modal.editing ? modal.editing.plateNumber : ''
  );
  const [vehType, setVehType] = useState(
    modal.kind === 'vehicle' && modal.editing ? modal.editing.unitType : ''
  );
  const [vehDeptId, setVehDeptId] = useState(
    modal.kind === 'vehicle' && modal.editing
      ? modal.editing.departmentId
      : departments[0]?.id ?? ''
  );

  const modalTitle =
    modal.kind === 'department'
      ? modal.editing
        ? 'Ubah Data Divisi'
        : 'Tambah Divisi Baru'
      : modal.kind === 'employee'
      ? modal.editing
        ? 'Ubah Data Karyawan'
        : 'Tambah Karyawan / Driver Baru'
      : modal.kind === 'category'
      ? modal.editing
        ? 'Ubah Kategori Biaya'
        : 'Tambah Kategori Biaya Baru'
      : modal.editing
      ? 'Ubah Unit Armada'
      : 'Tambah Unit Armada Baru';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);
    let res: { ok: boolean; error?: string } = { ok: false };

    if (modal.kind === 'department') {
      const monthlyBudget = parseFormattedNumber(deptBudgetStr);
      const lowBalanceThreshold = parseFormattedNumber(deptThresholdStr);
      if (modal.editing) {
        res = await onUpdateDepartment({
          departmentId: modal.editing.id,
          code: normalizeCode(deptCode),
          name: deptName,
          picName: normalizePersonName(deptPic),
          monthlyBudget,
          lowBalanceThreshold,
        });
      } else {
        res = await onCreateDepartment({
          code: normalizeCode(deptCode),
          name: deptName,
          picName: normalizePersonName(deptPic),
          monthlyBudget,
          lowBalanceThreshold,
          initialBalance: parseFormattedNumber(deptInitialBalanceStr),
        });
      }
    } else if (modal.kind === 'employee') {
      if (modal.editing) {
        res = await onUpdateEmployee({
          employeeId: modal.editing.id,
          code: normalizeCode(empCode),
          name: normalizePersonName(empName),
          roleTitle: empRoleTitle,
          departmentId: empDeptId,
        });
      } else {
        res = await onCreateEmployee({
          code: normalizeCode(empCode),
          name: normalizePersonName(empName),
          roleTitle: empRoleTitle,
          departmentId: empDeptId,
        });
      }
    } else if (modal.kind === 'category') {
      if (modal.editing) {
        res = await onUpdateCategory({
          categoryId: modal.editing.id,
          code: normalizeCode(catCode),
          name: catName,
          requiresVehicle: catRequiresVehicle,
        });
      } else {
        res = await onCreateCategory({
          code: normalizeCode(catCode),
          name: catName,
          requiresVehicle: catRequiresVehicle,
        });
      }
    } else if (modal.kind === 'vehicle') {
      const plateNumber = normalizePlateNumber(vehPlate);
      if (modal.editing) {
        res = await onUpdateVehicle({
          vehicleId: modal.editing.id,
          plateNumber,
          unitType: vehType,
          departmentId: vehDeptId,
        });
      } else {
        res = await onCreateVehicle({
          plateNumber,
          unitType: vehType,
          departmentId: vehDeptId,
        });
      }
    }

    setSaving(false);
    if (!res.ok) {
      setError(res.error || 'Gagal menyimpan data master.');
      return;
    }
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="master-modal-title"
    >
      <div className="w-full max-w-md rounded-xl bg-white border border-slate-200 p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h3
            id="master-modal-title"
            className="text-base font-semibold text-slate-900"
          >
            {modalTitle}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup form data master"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {modal.kind === 'department' && (
            <>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label
                    htmlFor="m-dept-code"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    Kode Divisi
                  </label>
                  <input
                    id="m-dept-code"
                    type="text"
                    value={deptCode}
                    onChange={(e) => setDeptCode(normalizeCode(e.target.value))}
                    placeholder="EXP"
                    required
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono uppercase text-slate-900 focus:border-emerald-700 focus:outline-none"
                  />
                </div>
                <div className="col-span-2">
                  <label
                    htmlFor="m-dept-name"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    Nama Divisi
                  </label>
                  <input
                    id="m-dept-name"
                    type="text"
                    value={deptName}
                    onChange={(e) => setDeptName(e.target.value)}
                    placeholder="Contoh: Pengiriman Ekspres"
                    required
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-emerald-700 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="m-dept-pic"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Penanggung Jawab (PIC)
                </label>
                <input
                  id="m-dept-pic"
                  type="text"
                  value={deptPic}
                  onChange={(e) => setDeptPic(e.target.value)}
                  onBlur={() => setDeptPic(normalizePersonName(deptPic))}
                  placeholder="Contoh: Hendra Wijaya"
                  required
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-emerald-700 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="m-dept-budget"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    Plafon Bulanan (IDR)
                  </label>
                  <input
                    id="m-dept-budget"
                    type="text"
                    inputMode="numeric"
                    value={deptBudgetStr}
                    onChange={(e) =>
                      setDeptBudgetStr(formatNumberInput(e.target.value))
                    }
                    required
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono tabular-nums text-slate-900 focus:border-emerald-700 focus:outline-none"
                  />
                </div>
                <div>
                  <label
                    htmlFor="m-dept-threshold"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    Batas Peringatan (IDR)
                  </label>
                  <input
                    id="m-dept-threshold"
                    type="text"
                    inputMode="numeric"
                    value={deptThresholdStr}
                    onChange={(e) =>
                      setDeptThresholdStr(formatNumberInput(e.target.value))
                    }
                    required
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono tabular-nums text-slate-900 focus:border-emerald-700 focus:outline-none"
                  />
                </div>
              </div>

              {!modal.editing && (
                <div>
                  <label
                    htmlFor="m-dept-balance"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    Saldo Awal Kas Kecil (IDR)
                  </label>
                  <input
                    id="m-dept-balance"
                    type="text"
                    inputMode="numeric"
                    value={deptInitialBalanceStr}
                    onChange={(e) =>
                      setDeptInitialBalanceStr(
                        formatNumberInput(e.target.value)
                      )
                    }
                    required
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono tabular-nums text-slate-900 focus:border-emerald-700 focus:outline-none"
                  />
                </div>
              )}
            </>
          )}

          {modal.kind === 'employee' && (
            <>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label
                    htmlFor="m-emp-code"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    NIK / Kode
                  </label>
                  <input
                    id="m-emp-code"
                    type="text"
                    value={empCode}
                    onChange={(e) => setEmpCode(normalizeCode(e.target.value))}
                    placeholder="KRY-007"
                    required
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono uppercase text-slate-900 focus:border-emerald-700 focus:outline-none"
                  />
                </div>
                <div className="col-span-2">
                  <label
                    htmlFor="m-emp-name"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    Nama Lengkap
                  </label>
                  <input
                    id="m-emp-name"
                    type="text"
                    value={empName}
                    onChange={(e) => setEmpName(e.target.value)}
                    onBlur={() => setEmpName(normalizePersonName(empName))}
                    placeholder="Contoh: Rahmat Hidayat"
                    required
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-emerald-700 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="m-emp-role"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Jabatan / Peran
                </label>
                <input
                  id="m-emp-role"
                  type="text"
                  value={empRoleTitle}
                  onChange={(e) => setEmpRoleTitle(e.target.value)}
                  placeholder="Contoh: Driver Trailer 40ft"
                  required
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-emerald-700 focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="m-emp-dept"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Divisi Default
                </label>
                <select
                  id="m-emp-dept"
                  value={empDeptId}
                  onChange={(e) => setEmpDeptId(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-700 focus:outline-none"
                >
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.code} — {d.name}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          {modal.kind === 'category' && (
            <>
              <div>
                <label
                  htmlFor="m-cat-code"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Kode Kategori
                </label>
                <input
                  id="m-cat-code"
                  type="text"
                  value={catCode}
                  onChange={(e) => setCatCode(normalizeCode(e.target.value))}
                  placeholder="KAT-PKT"
                  required
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono uppercase text-slate-900 focus:border-emerald-700 focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="m-cat-name"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Nama Kategori Biaya
                </label>
                <input
                  id="m-cat-name"
                  type="text"
                  value={catName}
                  onChange={(e) => setCatName(e.target.value)}
                  placeholder="Contoh: Parkir & Retribusi Terminal"
                  required
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-emerald-700 focus:outline-none"
                />
              </div>

              <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={catRequiresVehicle}
                  onChange={(e) => setCatRequiresVehicle(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-700"
                />
                <span>
                  Terkait unit armada (tampilkan saran No. Polisi saat
                  pengajuan)
                </span>
              </label>
            </>
          )}

          {modal.kind === 'vehicle' && (
            <>
              <div>
                <label
                  htmlFor="m-veh-plate"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Nomor Polisi
                </label>
                <input
                  id="m-veh-plate"
                  type="text"
                  value={vehPlate}
                  onChange={(e) => setVehPlate(e.target.value.toUpperCase())}
                  onBlur={() => setVehPlate(normalizePlateNumber(vehPlate))}
                  placeholder="B 9912 KRG"
                  required
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono uppercase text-slate-900 focus:border-emerald-700 focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="m-veh-type"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Jenis / Tipe Armada
                </label>
                <input
                  id="m-veh-type"
                  type="text"
                  value={vehType}
                  onChange={(e) => setVehType(e.target.value)}
                  placeholder="Contoh: Wingbox Tronton"
                  required
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-emerald-700 focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="m-veh-dept"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Divisi Pengelola
                </label>
                <select
                  id="m-veh-dept"
                  value={vehDeptId}
                  onChange={(e) => setVehDeptId(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-700 focus:outline-none"
                >
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.code} — {d.name}
                    </option>
                  ))}
                </select>
              </div>
            </>
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
              disabled={saving}
              className="rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
            >
              {saving ? 'Menyimpan...' : 'Simpan Data'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
