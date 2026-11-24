import crypto from 'node:crypto';
import type {
  Department,
  MasterCategory,
  MasterEmployee,
  MasterVehicle,
} from '../../src/types/pettycash.ts';
import {
  validateMasterCategoryInput,
  validateMasterDepartmentInput,
  validateMasterEmployeeInput,
  validateMasterVehicleInput,
} from '../../src/utils/pettycashLogic.ts';
import { memoryDb, writeDbAtomically } from '../db.ts';

export function createDepartment(params: {
  code: string;
  name: string;
  picName: string;
  monthlyBudget: number;
  lowBalanceThreshold: number;
  initialBalance?: number;
}): { ok: boolean; error?: string } {
  const check = validateMasterDepartmentInput(params);
  if (!check.valid || !check.normalized) {
    return { ok: false, error: check.error };
  }
  const { code, name, picName, monthlyBudget, lowBalanceThreshold } =
    check.normalized;
  if (memoryDb.departments.some((d) => d.code === code)) {
    return { ok: false, error: `Kode divisi ${code} sudah terdaftar.` };
  }
  const initialBalance = Number.isInteger(params.initialBalance)
    ? Math.max(0, params.initialBalance!)
    : 0;

  const nowIso = new Date().toISOString();
  const newDept: Department = {
    id: `dept-${crypto.randomUUID().slice(0, 6)}`,
    code,
    name,
    picName,
    monthlyBudget,
    balance: initialBalance,
    lowBalanceThreshold,
    active: true,
    updatedAt: nowIso,
  };
  memoryDb.departments = [...memoryDb.departments, newDept];
  writeDbAtomically(memoryDb);
  return { ok: true };
}

export function updateDepartmentConfig(params: {
  departmentId: string;
  code?: string;
  name?: string;
  picName: string;
  monthlyBudget: number;
  lowBalanceThreshold: number;
  active?: boolean;
}): { ok: boolean; error?: string } {
  const dept = memoryDb.departments.find((d) => d.id === params.departmentId);
  if (!dept) {
    return { ok: false, error: 'Divisi tidak ditemukan.' };
  }
  const check = validateMasterDepartmentInput({
    code: params.code ?? dept.code,
    name: params.name ?? dept.name,
    picName: params.picName,
    monthlyBudget: params.monthlyBudget,
    lowBalanceThreshold: params.lowBalanceThreshold,
  });
  if (!check.valid || !check.normalized) {
    return { ok: false, error: check.error };
  }
  const { code, name, picName, monthlyBudget, lowBalanceThreshold } =
    check.normalized;

  if (
    memoryDb.departments.some((d) => d.id !== dept.id && d.code === code)
  ) {
    return { ok: false, error: `Kode divisi ${code} sudah digunakan.` };
  }

  dept.code = code;
  dept.name = name;
  dept.picName = picName;
  dept.monthlyBudget = monthlyBudget;
  dept.lowBalanceThreshold = lowBalanceThreshold;
  if (typeof params.active === 'boolean') {
    dept.active = params.active;
  }
  dept.updatedAt = new Date().toISOString();
  writeDbAtomically(memoryDb);
  return { ok: true };
}

export function createEmployee(params: {
  code: string;
  name: string;
  roleTitle: string;
  departmentId: string;
}): { ok: boolean; error?: string } {
  const check = validateMasterEmployeeInput(params);
  if (!check.valid || !check.normalized) {
    return { ok: false, error: check.error };
  }
  const { code, name, roleTitle, departmentId } = check.normalized;
  if (!memoryDb.departments.some((d) => d.id === departmentId)) {
    return { ok: false, error: 'Divisi tidak ditemukan.' };
  }
  if (memoryDb.employees.some((e) => e.code === code)) {
    return { ok: false, error: `Kode karyawan ${code} sudah terdaftar.` };
  }
  const newEmp: MasterEmployee = {
    id: `emp-${crypto.randomUUID().slice(0, 6)}`,
    code,
    name,
    roleTitle,
    departmentId,
    active: true,
    updatedAt: new Date().toISOString(),
  };
  memoryDb.employees = [...memoryDb.employees, newEmp];
  writeDbAtomically(memoryDb);
  return { ok: true };
}

export function updateEmployee(params: {
  employeeId: string;
  code?: string;
  name?: string;
  roleTitle?: string;
  departmentId?: string;
  active?: boolean;
}): { ok: boolean; error?: string } {
  const emp = memoryDb.employees.find((e) => e.id === params.employeeId);
  if (!emp) {
    return { ok: false, error: 'Data karyawan tidak ditemukan.' };
  }
  const check = validateMasterEmployeeInput({
    code: params.code ?? emp.code,
    name: params.name ?? emp.name,
    roleTitle: params.roleTitle ?? emp.roleTitle,
    departmentId: params.departmentId ?? emp.departmentId,
  });
  if (!check.valid || !check.normalized) {
    return { ok: false, error: check.error };
  }
  const { code, name, roleTitle, departmentId } = check.normalized;
  if (!memoryDb.departments.some((d) => d.id === departmentId)) {
    return { ok: false, error: 'Divisi tidak ditemukan.' };
  }
  if (memoryDb.employees.some((e) => e.id !== emp.id && e.code === code)) {
    return { ok: false, error: `Kode karyawan ${code} sudah digunakan.` };
  }

  emp.code = code;
  emp.name = name;
  emp.roleTitle = roleTitle;
  emp.departmentId = departmentId;
  if (typeof params.active === 'boolean') {
    emp.active = params.active;
  }
  emp.updatedAt = new Date().toISOString();
  writeDbAtomically(memoryDb);
  return { ok: true };
}

export function createCategory(params: {
  code: string;
  name: string;
  requiresVehicle: boolean;
}): { ok: boolean; error?: string } {
  const check = validateMasterCategoryInput(params);
  if (!check.valid || !check.normalized) {
    return { ok: false, error: check.error };
  }
  const { code, name, requiresVehicle } = check.normalized;
  if (memoryDb.categories.some((c) => c.code === code)) {
    return { ok: false, error: `Kode kategori ${code} sudah terdaftar.` };
  }
  if (
    memoryDb.categories.some(
      (c) => c.name.toLowerCase() === name.toLowerCase()
    )
  ) {
    return { ok: false, error: `Kategori "${name}" sudah terdaftar.` };
  }
  const newCat: MasterCategory = {
    id: `cat-${crypto.randomUUID().slice(0, 6)}`,
    code,
    name,
    requiresVehicle,
    active: true,
    updatedAt: new Date().toISOString(),
  };
  memoryDb.categories = [...memoryDb.categories, newCat];
  writeDbAtomically(memoryDb);
  return { ok: true };
}

export function updateCategory(params: {
  categoryId: string;
  code?: string;
  name?: string;
  requiresVehicle?: boolean;
  active?: boolean;
}): { ok: boolean; error?: string } {
  const cat = memoryDb.categories.find((c) => c.id === params.categoryId);
  if (!cat) {
    return { ok: false, error: 'Data kategori tidak ditemukan.' };
  }
  const check = validateMasterCategoryInput({
    code: params.code ?? cat.code,
    name: params.name ?? cat.name,
    requiresVehicle: params.requiresVehicle ?? cat.requiresVehicle,
  });
  if (!check.valid || !check.normalized) {
    return { ok: false, error: check.error };
  }
  const { code, name, requiresVehicle } = check.normalized;
  if (memoryDb.categories.some((c) => c.id !== cat.id && c.code === code)) {
    return { ok: false, error: `Kode kategori ${code} sudah digunakan.` };
  }
  if (
    memoryDb.categories.some(
      (c) => c.id !== cat.id && c.name.toLowerCase() === name.toLowerCase()
    )
  ) {
    return { ok: false, error: `Nama kategori "${name}" sudah digunakan.` };
  }

  const oldName = cat.name;
  cat.code = code;
  cat.name = name;
  cat.requiresVehicle = requiresVehicle;
  if (typeof params.active === 'boolean') {
    cat.active = params.active;
  }
  cat.updatedAt = new Date().toISOString();

  // Keep historical requests consistent if category display name is edited
  if (oldName !== name) {
    memoryDb.requests = memoryDb.requests.map((r) =>
      r.category === oldName ? { ...r, category: name } : r
    );
  }

  writeDbAtomically(memoryDb);
  return { ok: true };
}

export function createVehicle(params: {
  plateNumber: string;
  unitType: string;
  departmentId: string;
}): { ok: boolean; error?: string } {
  const check = validateMasterVehicleInput(params);
  if (!check.valid || !check.normalized) {
    return { ok: false, error: check.error };
  }
  const { plateNumber, unitType, departmentId } = check.normalized;
  if (!memoryDb.departments.some((d) => d.id === departmentId)) {
    return { ok: false, error: 'Divisi armada tidak ditemukan.' };
  }
  if (memoryDb.vehicles.some((v) => v.plateNumber === plateNumber)) {
    return {
      ok: false,
      error: `Nomor polisi ${plateNumber} sudah terdaftar.`,
    };
  }
  const newVeh: MasterVehicle = {
    id: `veh-${crypto.randomUUID().slice(0, 6)}`,
    plateNumber,
    unitType,
    departmentId,
    active: true,
    updatedAt: new Date().toISOString(),
  };
  memoryDb.vehicles = [...memoryDb.vehicles, newVeh];
  writeDbAtomically(memoryDb);
  return { ok: true };
}

export function updateVehicle(params: {
  vehicleId: string;
  plateNumber?: string;
  unitType?: string;
  departmentId?: string;
  active?: boolean;
}): { ok: boolean; error?: string } {
  const veh = memoryDb.vehicles.find((v) => v.id === params.vehicleId);
  if (!veh) {
    return { ok: false, error: 'Data armada tidak ditemukan.' };
  }
  const check = validateMasterVehicleInput({
    plateNumber: params.plateNumber ?? veh.plateNumber,
    unitType: params.unitType ?? veh.unitType,
    departmentId: params.departmentId ?? veh.departmentId,
  });
  if (!check.valid || !check.normalized) {
    return { ok: false, error: check.error };
  }
  const { plateNumber, unitType, departmentId } = check.normalized;
  if (!memoryDb.departments.some((d) => d.id === departmentId)) {
    return { ok: false, error: 'Divisi armada tidak ditemukan.' };
  }
  if (
    memoryDb.vehicles.some(
      (v) => v.id !== veh.id && v.plateNumber === plateNumber
    )
  ) {
    return {
      ok: false,
      error: `Nomor polisi ${plateNumber} sudah digunakan.`,
    };
  }

  veh.plateNumber = plateNumber;
  veh.unitType = unitType;
  veh.departmentId = departmentId;
  if (typeof params.active === 'boolean') {
    veh.active = params.active;
  }
  veh.updatedAt = new Date().toISOString();
  writeDbAtomically(memoryDb);
  return { ok: true };
}
