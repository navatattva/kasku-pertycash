import QRCode from 'qrcode';
import type { DownPaymentRecord } from '../types/pettycash.ts';

export interface ParsedKasbonVerificationParams {
  tab: string | null;
  verifyKasbonId: string | null;
  refNumber: string | null;
}

export function buildKasbonVerificationUrl(
  origin: string,
  dp: Pick<DownPaymentRecord, 'id' | 'dpNumber'>
): string {
  const cleanOrigin = origin.replace(/\/+$/, '');
  const params = new URLSearchParams({
    tab: 'down-payments',
    verifyKasbon: dp.id,
    ref: dp.dpNumber,
  });
  return `${cleanOrigin}/?${params.toString()}`;
}

export function parseKasbonVerificationParams(
  search: string
): ParsedKasbonVerificationParams {
  const clean = search.startsWith('?') ? search.slice(1) : search;
  const params = new URLSearchParams(clean);
  const verifyKasbonId = params.get('verifyKasbon')?.trim() || null;
  const refNumber = params.get('ref')?.trim() || null;
  const tab = params.get('tab')?.trim() || null;
  return {
    tab,
    verifyKasbonId,
    refNumber,
  };
}

export async function generateQrSvgString(
  text: string,
  width = 180
): Promise<string> {
  return QRCode.toString(text, {
    type: 'svg',
    width,
    margin: 2,
    errorCorrectionLevel: 'M',
    color: {
      dark: '#0f172a',
      light: '#ffffff',
    },
  });
}

export async function generateQrDataUrl(
  text: string,
  width = 320
): Promise<string> {
  return QRCode.toDataURL(text, {
    width,
    margin: 2,
    errorCorrectionLevel: 'M',
    color: {
      dark: '#0f172a',
      light: '#ffffff',
    },
  });
}
