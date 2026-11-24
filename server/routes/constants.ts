import type { TaxSchemeId, UserRole } from '../../src/types/pettycash.ts';

export const VALID_ROLES = new Set<UserRole>(['staff', 'director']);

export const VALID_TAX_SCHEMES = new Set<TaxSchemeId>([
  'none',
  'ppn_exclusive',
  'ppn_inclusive',
  'pph23_2',
  'pph21_ter_05',
  'pph21_non_emp_25',
]);
