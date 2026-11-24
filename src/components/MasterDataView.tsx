import { useMemo, useState } from 'react';
import { Building2, Plus, Search, Tag, Truck, Users } from 'lucide-react';
import type {
  Department,
  MasterCategory,
  MasterEmployee,
  MasterVehicle,
  PermissionKey,
} from '../types/pettycash.ts';
import { hasPermission } from '../utils/pettycashLogic.ts';
import { MasterFormModal } from './master/MasterFormModal.tsx';
import {
  CategoriesMasterTable,
  DepartmentsMasterTable,
  EmployeesMasterTable,
  VehiclesMasterTable,
} from './master/MasterTables.tsx';
import type {
  MasterDataCallbacks,
  MasterModalState,
  MasterTab,
} from './master/masterShared.ts';

interface MasterDataViewProps extends MasterDataCallbacks {
  departments: Department[];
  employees: MasterEmployee[];
  categories: MasterCategory[];
  vehicles: MasterVehicle[];
  userPermissions: readonly PermissionKey[];
}

export function MasterDataView({
  departments,
  employees,
  categories,
  vehicles,
  userPermissions,
  onCreateDepartment,
  onUpdateDepartment,
  onCreateEmployee,
  onUpdateEmployee,
  onCreateCategory,
  onUpdateCategory,
  onCreateVehicle,
  onUpdateVehicle,
}: MasterDataViewProps) {
  const canManage = hasPermission(userPermissions, 'master:manage');
  const [subTab, setSubTab] = useState<MasterTab>('departments');
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<MasterModalState>(null);

  const deptMap = useMemo(
    () => new Map(departments.map((d) => [d.id, d])),
    [departments]
  );

  const query = search.trim().toLowerCase();

  const filteredDepartments = useMemo(() => {
    if (!query) return departments;
    return departments.filter(
      (d) =>
        d.code.toLowerCase().includes(query) ||
        d.name.toLowerCase().includes(query) ||
        d.picName.toLowerCase().includes(query)
    );
  }, [departments, query]);

  const filteredEmployees = useMemo(() => {
    if (!query) return employees;
    return employees.filter((e) => {
      const deptName = deptMap.get(e.departmentId)?.name.toLowerCase() ?? '';
      return (
        e.code.toLowerCase().includes(query) ||
        e.name.toLowerCase().includes(query) ||
        e.roleTitle.toLowerCase().includes(query) ||
        deptName.includes(query)
      );
    });
  }, [employees, deptMap, query]);

  const filteredCategories = useMemo(() => {
    if (!query) return categories;
    return categories.filter(
      (c) =>
        c.code.toLowerCase().includes(query) ||
        c.name.toLowerCase().includes(query)
    );
  }, [categories, query]);

  const filteredVehicles = useMemo(() => {
    if (!query) return vehicles;
    return vehicles.filter((v) => {
      const deptName = deptMap.get(v.departmentId)?.name.toLowerCase() ?? '';
      return (
        v.plateNumber.toLowerCase().includes(query) ||
        v.unitType.toLowerCase().includes(query) ||
        deptName.includes(query)
      );
    });
  }, [vehicles, deptMap, query]);

  const subTabs: {
    id: MasterTab;
    label: string;
    count: number;
    icon: typeof Building2;
  }[] = [
    {
      id: 'departments',
      label: 'Divisi',
      count: departments.length,
      icon: Building2,
    },
    {
      id: 'employees',
      label: 'Karyawan & Driver',
      count: employees.length,
      icon: Users,
    },
    {
      id: 'categories',
      label: 'Kategori Biaya',
      count: categories.length,
      icon: Tag,
    },
    {
      id: 'vehicles',
      label: 'Armada & Truk',
      count: vehicles.length,
      icon: Truck,
    },
  ];

  const addLabel: Record<MasterTab, string> = {
    departments: 'Tambah Divisi',
    employees: 'Tambah Karyawan',
    categories: 'Tambah Kategori',
    vehicles: 'Tambah Armada',
  };

  function handleOpenCreate() {
    if (subTab === 'departments') setModal({ kind: 'department' });
    if (subTab === 'employees') setModal({ kind: 'employee' });
    if (subTab === 'categories') setModal({ kind: 'category' });
    if (subTab === 'vehicles') setModal({ kind: 'vehicle' });
  }

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div
          role="tablist"
          aria-label="Kategori Data Master"
          className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg"
        >
          {subTabs.map((t) => {
            const Icon = t.icon;
            const active = subTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => {
                  setSubTab(t.id);
                  setSearch('');
                }}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{t.label}</span>
                <span className="font-mono tabular-nums text-slate-400">
                  {t.count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 sm:w-64">
            <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari kode, nama, atau unit..."
              aria-label="Cari data master"
              className="w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-700/20"
            />
          </div>

          {canManage && (
            <button
              type="button"
              onClick={handleOpenCreate}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-800 whitespace-nowrap shrink-0"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>{addLabel[subTab]}</span>
            </button>
          )}
        </div>
      </div>

      {/* Standardization Info Strip */}
      <div className="bg-white border border-slate-200 rounded-xl px-5 py-3.5 text-xs text-slate-600 flex flex-wrap items-center justify-between gap-2">
        <span>
          <strong className="font-semibold text-slate-800">
            Standarisasi Input Otomatis:
          </strong>{' '}
          Kode divisi &amp; karyawan otomatis huruf kapital, nama pemohon
          dirapikan ke format Title Case, dan nomor polisi diformat seragam
          (contoh: <span className="font-mono text-slate-800">B 9241 KRG</span>
          ).
        </span>
      </div>

      {subTab === 'departments' && (
        <DepartmentsMasterTable
          departments={filteredDepartments}
          canManage={canManage}
          onEdit={setModal}
          onUpdateDepartment={onUpdateDepartment}
        />
      )}

      {subTab === 'employees' && (
        <EmployeesMasterTable
          employees={filteredEmployees}
          deptMap={deptMap}
          canManage={canManage}
          onEdit={setModal}
          onUpdateEmployee={onUpdateEmployee}
        />
      )}

      {subTab === 'categories' && (
        <CategoriesMasterTable
          categories={filteredCategories}
          canManage={canManage}
          onEdit={setModal}
          onUpdateCategory={onUpdateCategory}
        />
      )}

      {subTab === 'vehicles' && (
        <VehiclesMasterTable
          vehicles={filteredVehicles}
          deptMap={deptMap}
          canManage={canManage}
          onEdit={setModal}
          onUpdateVehicle={onUpdateVehicle}
        />
      )}

      {canManage && modal && (
        <MasterFormModal
          modal={modal}
          departments={departments}
          onClose={() => setModal(null)}
          onCreateDepartment={onCreateDepartment}
          onUpdateDepartment={onUpdateDepartment}
          onCreateEmployee={onCreateEmployee}
          onUpdateEmployee={onUpdateEmployee}
          onCreateCategory={onCreateCategory}
          onUpdateCategory={onUpdateCategory}
          onCreateVehicle={onCreateVehicle}
          onUpdateVehicle={onUpdateVehicle}
        />
      )}
    </div>
  );
}
