import { Pencil } from 'lucide-react';
import type {
  Department,
  MasterCategory,
  MasterEmployee,
  MasterVehicle,
} from '../../types/pettycash.ts';
import { formatIDR } from '../../utils/formatters.ts';
import { MasterStatusIndicator } from './MasterStatusIndicator.tsx';
import type {
  MasterDataCallbacks,
  MasterModalState,
} from './masterShared.ts';

interface DepartmentsTableProps {
  departments: Department[];
  canManage: boolean;
  onEdit: (modal: MasterModalState) => void;
  onUpdateDepartment: MasterDataCallbacks['onUpdateDepartment'];
}

export function DepartmentsMasterTable({
  departments,
  canManage,
  onEdit,
  onUpdateDepartment,
}: DepartmentsTableProps) {
  return (
    <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-200">
        <h2 className="text-base font-semibold text-slate-900">
          Master Divisi Operasional
        </h2>
        <p className="text-xs text-slate-500">
          Divisi aktif otomatis muncul pada dropdown form pengajuan petty cash.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
              <th className="py-3 px-4">Kode</th>
              <th className="py-3 px-4">Nama Divisi</th>
              <th className="py-3 px-4">PIC</th>
              <th className="py-3 px-4 text-right">Plafon Bulanan</th>
              <th className="py-3 px-4 text-right">Batas Peringatan</th>
              <th className="py-3 px-4">Status</th>
              {canManage && <th className="py-3 px-4 text-right">Aksi</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {departments.map((d) => {
              const isActive = d.active !== false;
              return (
                <tr key={d.id} className="hover:bg-slate-50/70">
                  <td className="py-3.5 px-4 font-mono font-semibold text-slate-800 whitespace-nowrap">
                    {d.code}
                  </td>
                  <td className="py-3.5 px-4 font-medium text-slate-900">
                    {d.name}
                  </td>
                  <td className="py-3.5 px-4 text-slate-700">{d.picName}</td>
                  <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-800 whitespace-nowrap">
                    {formatIDR(d.monthlyBudget)}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-600 whitespace-nowrap">
                    {formatIDR(d.lowBalanceThreshold)}
                  </td>
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <MasterStatusIndicator active={isActive} />
                  </td>
                  {canManage && (
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            onEdit({ kind: 'department', editing: d })
                          }
                          aria-label={`Ubah divisi ${d.name}`}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          <span>Ubah</span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            onUpdateDepartment({
                              departmentId: d.id,
                              code: d.code,
                              name: d.name,
                              picName: d.picName,
                              monthlyBudget: d.monthlyBudget,
                              lowBalanceThreshold: d.lowBalanceThreshold,
                              active: !isActive,
                            })
                          }
                          aria-label={`${isActive ? 'Nonaktifkan' : 'Aktifkan'} divisi ${d.name}`}
                          className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          {isActive ? 'Nonaktifkan' : 'Aktifkan'}
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

interface EmployeesTableProps {
  employees: MasterEmployee[];
  deptMap: Map<string, Department>;
  canManage: boolean;
  onEdit: (modal: MasterModalState) => void;
  onUpdateEmployee: MasterDataCallbacks['onUpdateEmployee'];
}

export function EmployeesMasterTable({
  employees,
  deptMap,
  canManage,
  onEdit,
  onUpdateEmployee,
}: EmployeesTableProps) {
  return (
    <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-200">
        <h2 className="text-base font-semibold text-slate-900">
          Master Karyawan &amp; Driver Pemohon
        </h2>
        <p className="text-xs text-slate-500">
          Memastikan penulisan nama pemohon di setiap transaksi dan laporan
          tetap seragam tanpa salah ketik.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
              <th className="py-3 px-4">NIK / Kode</th>
              <th className="py-3 px-4">Nama Lengkap</th>
              <th className="py-3 px-4">Jabatan / Peran</th>
              <th className="py-3 px-4">Divisi Default</th>
              <th className="py-3 px-4">Status</th>
              {canManage && <th className="py-3 px-4 text-right">Aksi</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {employees.map((emp) => (
              <tr key={emp.id} className="hover:bg-slate-50/70">
                <td className="py-3.5 px-4 font-mono font-semibold text-slate-800 whitespace-nowrap">
                  {emp.code}
                </td>
                <td className="py-3.5 px-4 font-medium text-slate-900">
                  {emp.name}
                </td>
                <td className="py-3.5 px-4 text-slate-700">{emp.roleTitle}</td>
                <td className="py-3.5 px-4 text-slate-700">
                  {deptMap.get(emp.departmentId)?.name ?? emp.departmentId}
                </td>
                <td className="py-3.5 px-4 whitespace-nowrap">
                  <MasterStatusIndicator active={emp.active} />
                </td>
                {canManage && (
                  <td className="py-3.5 px-4 text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          onEdit({ kind: 'employee', editing: emp })
                        }
                        aria-label={`Ubah karyawan ${emp.name}`}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        <span>Ubah</span>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateEmployee({
                            employeeId: emp.id,
                            active: !emp.active,
                          })
                        }
                        aria-label={`${emp.active ? 'Nonaktifkan' : 'Aktifkan'} karyawan ${emp.name}`}
                        className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        {emp.active ? 'Nonaktifkan' : 'Aktifkan'}
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

interface CategoriesTableProps {
  categories: MasterCategory[];
  canManage: boolean;
  onEdit: (modal: MasterModalState) => void;
  onUpdateCategory: MasterDataCallbacks['onUpdateCategory'];
}

export function CategoriesMasterTable({
  categories,
  canManage,
  onEdit,
  onUpdateCategory,
}: CategoriesTableProps) {
  return (
    <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-200">
        <h2 className="text-base font-semibold text-slate-900">
          Master Kategori Pengeluaran Kargo
        </h2>
        <p className="text-xs text-slate-500">
          Mengelompokkan pengeluaran operasional secara konsisten pada grafik
          realisasi dan laporan bulanan.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
              <th className="py-3 px-4">Kode</th>
              <th className="py-3 px-4">Nama Kategori</th>
              <th className="py-3 px-4">Terkait Unit Armada</th>
              <th className="py-3 px-4">Status</th>
              {canManage && <th className="py-3 px-4 text-right">Aksi</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {categories.map((cat) => (
              <tr key={cat.id} className="hover:bg-slate-50/70">
                <td className="py-3.5 px-4 font-mono font-semibold text-slate-800 whitespace-nowrap">
                  {cat.code}
                </td>
                <td className="py-3.5 px-4 font-medium text-slate-900">
                  {cat.name}
                </td>
                <td className="py-3.5 px-4 text-xs text-slate-600">
                  {cat.requiresVehicle
                    ? 'Ya (Saran pilih No. Polisi)'
                    : 'Opsional'}
                </td>
                <td className="py-3.5 px-4 whitespace-nowrap">
                  <MasterStatusIndicator active={cat.active} />
                </td>
                {canManage && (
                  <td className="py-3.5 px-4 text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          onEdit({ kind: 'category', editing: cat })
                        }
                        aria-label={`Ubah kategori ${cat.name}`}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        <span>Ubah</span>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateCategory({
                            categoryId: cat.id,
                            active: !cat.active,
                          })
                        }
                        aria-label={`${cat.active ? 'Nonaktifkan' : 'Aktifkan'} kategori ${cat.name}`}
                        className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        {cat.active ? 'Nonaktifkan' : 'Aktifkan'}
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

interface VehiclesTableProps {
  vehicles: MasterVehicle[];
  deptMap: Map<string, Department>;
  canManage: boolean;
  onEdit: (modal: MasterModalState) => void;
  onUpdateVehicle: MasterDataCallbacks['onUpdateVehicle'];
}

export function VehiclesMasterTable({
  vehicles,
  deptMap,
  canManage,
  onEdit,
  onUpdateVehicle,
}: VehiclesTableProps) {
  return (
    <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-200">
        <h2 className="text-base font-semibold text-slate-900">
          Master Armada &amp; Nomor Polisi
        </h2>
        <p className="text-xs text-slate-500">
          Daftar resmi kendaraan operasional agar pencatatan BBM, tol, dan
          perawatan per unit truk seragam.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
              <th className="py-3 px-4">No. Polisi</th>
              <th className="py-3 px-4">Jenis Unit Armada</th>
              <th className="py-3 px-4">Divisi Pengelola</th>
              <th className="py-3 px-4">Status</th>
              {canManage && <th className="py-3 px-4 text-right">Aksi</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {vehicles.map((v) => (
              <tr key={v.id} className="hover:bg-slate-50/70">
                <td className="py-3.5 px-4 font-mono font-semibold text-slate-900 whitespace-nowrap">
                  {v.plateNumber}
                </td>
                <td className="py-3.5 px-4 text-slate-800">{v.unitType}</td>
                <td className="py-3.5 px-4 text-slate-700">
                  {deptMap.get(v.departmentId)?.name ?? v.departmentId}
                </td>
                <td className="py-3.5 px-4 whitespace-nowrap">
                  <MasterStatusIndicator active={v.active} />
                </td>
                {canManage && (
                  <td className="py-3.5 px-4 text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onEdit({ kind: 'vehicle', editing: v })}
                        aria-label={`Ubah armada ${v.plateNumber}`}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        <span>Ubah</span>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateVehicle({
                            vehicleId: v.id,
                            active: !v.active,
                          })
                        }
                        aria-label={`${v.active ? 'Nonaktifkan' : 'Aktifkan'} armada ${v.plateNumber}`}
                        className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        {v.active ? 'Nonaktifkan' : 'Aktifkan'}
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
