import {
  normalizeCode,
  normalizePersonName,
  normalizePlateNumber,
} from '../formatters.ts';

export function validateMasterDepartmentInput(input: {
  code: string;
  name: string;
  picName: string;
  monthlyBudget: number;
  lowBalanceThreshold: number;
}): {
  valid: boolean;
  error?: string;
  normalized?: {
    code: string;
    name: string;
    picName: string;
    monthlyBudget: number;
    lowBalanceThreshold: number;
  };
} {
  const code = normalizeCode(input.code);
  const name = input.name.trim().replace(/\s+/g, ' ');
  const picName = normalizePersonName(input.picName);

  if (code.length < 2 || code.length > 10) {
    return { valid: false, error: 'Kode divisi wajib 2–10 karakter huruf/angka.' };
  }
  if (name.length < 3 || name.length > 80) {
    return { valid: false, error: 'Nama divisi wajib diisi (3–80 karakter).' };
  }
  if (picName.length < 2 || picName.length > 80) {
    return { valid: false, error: 'Nama PIC wajib diisi (2–80 karakter).' };
  }
  if (!Number.isInteger(input.monthlyBudget) || input.monthlyBudget <= 0) {
    return { valid: false, error: 'Plafon bulanan harus lebih dari Rp 0.' };
  }
  if (
    !Number.isInteger(input.lowBalanceThreshold) ||
    input.lowBalanceThreshold < 0
  ) {
    return { valid: false, error: 'Batas peringatan saldo tidak valid.' };
  }

  return {
    valid: true,
    normalized: {
      code,
      name,
      picName,
      monthlyBudget: input.monthlyBudget,
      lowBalanceThreshold: input.lowBalanceThreshold,
    },
  };
}

export function validateMasterEmployeeInput(input: {
  code: string;
  name: string;
  roleTitle: string;
  departmentId: string;
}): {
  valid: boolean;
  error?: string;
  normalized?: {
    code: string;
    name: string;
    roleTitle: string;
    departmentId: string;
  };
} {
  const code = normalizeCode(input.code);
  const name = normalizePersonName(input.name);
  const roleTitle = input.roleTitle.trim().replace(/\s+/g, ' ');

  if (code.length < 2 || code.length > 16) {
    return { valid: false, error: 'NIK / Kode karyawan wajib 2–16 karakter.' };
  }
  if (name.length < 2 || name.length > 80) {
    return { valid: false, error: 'Nama karyawan wajib diisi (2–80 karakter).' };
  }
  if (roleTitle.length < 2 || roleTitle.length > 60) {
    return { valid: false, error: 'Jabatan wajib diisi (2–60 karakter).' };
  }
  if (!input.departmentId) {
    return { valid: false, error: 'Divisi karyawan wajib dipilih.' };
  }

  return {
    valid: true,
    normalized: {
      code,
      name,
      roleTitle,
      departmentId: input.departmentId,
    },
  };
}

export function validateMasterCategoryInput(input: {
  code: string;
  name: string;
  requiresVehicle: boolean;
}): {
  valid: boolean;
  error?: string;
  normalized?: {
    code: string;
    name: string;
    requiresVehicle: boolean;
  };
} {
  const code = normalizeCode(input.code);
  const name = input.name.trim().replace(/\s+/g, ' ');

  if (code.length < 2 || code.length > 16) {
    return { valid: false, error: 'Kode kategori wajib 2–16 karakter.' };
  }
  if (name.length < 3 || name.length > 60) {
    return { valid: false, error: 'Nama kategori wajib diisi (3–60 karakter).' };
  }

  return {
    valid: true,
    normalized: {
      code,
      name,
      requiresVehicle: Boolean(input.requiresVehicle),
    },
  };
}

export function validateMasterVehicleInput(input: {
  plateNumber: string;
  unitType: string;
  departmentId: string;
}): {
  valid: boolean;
  error?: string;
  normalized?: {
    plateNumber: string;
    unitType: string;
    departmentId: string;
  };
} {
  const plateNumber = normalizePlateNumber(input.plateNumber);
  const unitType = input.unitType.trim().replace(/\s+/g, ' ');

  if (plateNumber.length < 4 || plateNumber.length > 15) {
    return {
      valid: false,
      error: 'Nomor polisi armada tidak valid (contoh: B 9241 KRG).',
    };
  }
  if (unitType.length < 2 || unitType.length > 60) {
    return { valid: false, error: 'Jenis unit armada wajib diisi.' };
  }
  if (!input.departmentId) {
    return { valid: false, error: 'Divisi penanggung jawab armada wajib dipilih.' };
  }

  return {
    valid: true,
    normalized: {
      plateNumber,
      unitType,
      departmentId: input.departmentId,
    },
  };
}
