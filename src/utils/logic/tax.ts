import type { TaxCalculationInfo, TaxSchemeId } from '../../types/pettycash.ts';
import { TAX_SCHEMES } from './constants.ts';

export function calculateIndonesianTax(
  baseInputAmount: number,
  taxType: TaxSchemeId
): TaxCalculationInfo {
  const safeBase =
    Number.isFinite(baseInputAmount) && baseInputAmount > 0
      ? Math.round(baseInputAmount)
      : 0;
  const meta =
    TAX_SCHEMES.find((t) => t.id === taxType) ?? TAX_SCHEMES[0];

  if (safeBase === 0 || meta.id === 'none') {
    return {
      taxType: 'none',
      label: TAX_SCHEMES[0].shortLabel,
      ratePct: 0,
      baseInputAmount: safeBase,
      dppAmount: safeBase,
      ppnAmount: 0,
      pphAmount: 0,
      netDisbursed: safeBase,
    };
  }

  if (meta.id === 'ppn_exclusive') {
    const ppnAmount = Math.round(safeBase * 0.11);
    return {
      taxType: 'ppn_exclusive',
      label: meta.shortLabel,
      ratePct: 11,
      baseInputAmount: safeBase,
      dppAmount: safeBase,
      ppnAmount,
      pphAmount: 0,
      netDisbursed: safeBase + ppnAmount,
    };
  }

  if (meta.id === 'ppn_inclusive') {
    const dppAmount = Math.round(safeBase / 1.11);
    const ppnAmount = safeBase - dppAmount;
    return {
      taxType: 'ppn_inclusive',
      label: meta.shortLabel,
      ratePct: 11,
      baseInputAmount: safeBase,
      dppAmount,
      ppnAmount,
      pphAmount: 0,
      netDisbursed: safeBase,
    };
  }

  if (meta.id === 'pph23_2') {
    const pphAmount = Math.round(safeBase * 0.02);
    return {
      taxType: 'pph23_2',
      label: meta.shortLabel,
      ratePct: 2,
      baseInputAmount: safeBase,
      dppAmount: safeBase,
      ppnAmount: 0,
      pphAmount,
      netDisbursed: Math.max(0, safeBase - pphAmount),
    };
  }

  if (meta.id === 'pph21_ter_05') {
    const pphAmount = Math.round(safeBase * 0.005);
    return {
      taxType: 'pph21_ter_05',
      label: meta.shortLabel,
      ratePct: 0.5,
      baseInputAmount: safeBase,
      dppAmount: safeBase,
      ppnAmount: 0,
      pphAmount,
      netDisbursed: Math.max(0, safeBase - pphAmount),
    };
  }

  // pph21_non_emp_25: 50% * bruto * 5% = 2.5%
  const dppAmount = Math.round(safeBase * 0.5);
  const pphAmount = Math.round(safeBase * 0.025);
  return {
    taxType: 'pph21_non_emp_25',
    label: meta.shortLabel,
    ratePct: 2.5,
    baseInputAmount: safeBase,
    dppAmount,
    ppnAmount: 0,
    pphAmount,
    netDisbursed: Math.max(0, safeBase - pphAmount),
  };
}
