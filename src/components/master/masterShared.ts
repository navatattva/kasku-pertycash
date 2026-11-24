import type {
  Department,
  MasterCategory,
  MasterEmployee,
  MasterVehicle,
} from '../../types/pettycash.ts';

export type MasterTab = 'departments' | 'employees' | 'categories' | 'vehicles';

export type MasterModalState =
  | { kind: 'department'; editing?: Department }
  | { kind: 'employee'; editing?: MasterEmployee }
  | { kind: 'category'; editing?: MasterCategory }
  | { kind: 'vehicle'; editing?: MasterVehicle }
  | null;

export interface MasterDataCallbacks {
  onCreateDepartment: (payload: {
    code: string;
    name: string;
    picName: string;
    monthlyBudget: number;
    lowBalanceThreshold: number;
    initialBalance: number;
  }) => Promise<{ ok: boolean; error?: string }>;
  onUpdateDepartment: (payload: {
    departmentId: string;
    code?: string;
    name?: string;
    picName: string;
    monthlyBudget: number;
    lowBalanceThreshold: number;
    active?: boolean;
  }) => Promise<{ ok: boolean; error?: string }>;
  onCreateEmployee: (payload: {
    code: string;
    name: string;
    roleTitle: string;
    departmentId: string;
  }) => Promise<{ ok: boolean; error?: string }>;
  onUpdateEmployee: (payload: {
    employeeId: string;
    code?: string;
    name?: string;
    roleTitle?: string;
    departmentId?: string;
    active?: boolean;
  }) => Promise<{ ok: boolean; error?: string }>;
  onCreateCategory: (payload: {
    code: string;
    name: string;
    requiresVehicle: boolean;
  }) => Promise<{ ok: boolean; error?: string }>;
  onUpdateCategory: (payload: {
    categoryId: string;
    code?: string;
    name?: string;
    requiresVehicle?: boolean;
    active?: boolean;
  }) => Promise<{ ok: boolean; error?: string }>;
  onCreateVehicle: (payload: {
    plateNumber: string;
    unitType: string;
    departmentId: string;
  }) => Promise<{ ok: boolean; error?: string }>;
  onUpdateVehicle: (payload: {
    vehicleId: string;
    plateNumber?: string;
    unitType?: string;
    departmentId?: string;
    active?: boolean;
  }) => Promise<{ ok: boolean; error?: string }>;
}
