import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildKasbonVerificationUrl,
  generateQrDataUrl,
  generateQrSvgString,
  parseKasbonVerificationParams,
} from './qrVerification.ts';

test('buildKasbonVerificationUrl builds a clean scannable verification link and parses back accurately', () => {
  const url = buildKasbonVerificationUrl('https://kaskukargo.id/', {
    id: 'dp-2026-01',
    dpNumber: 'KSB-202611-001',
  });

  assert.equal(
    url,
    'https://kaskukargo.id/?tab=down-payments&verifyKasbon=dp-2026-01&ref=KSB-202611-001'
  );

  const parsed = parseKasbonVerificationParams(new URL(url).search);
  assert.equal(parsed.tab, 'down-payments');
  assert.equal(parsed.verifyKasbonId, 'dp-2026-01');
  assert.equal(parsed.refNumber, 'KSB-202611-001');
});

test('parseKasbonVerificationParams handles empty or missing query params safely', () => {
  assert.deepEqual(parseKasbonVerificationParams(''), {
    tab: null,
    verifyKasbonId: null,
    refNumber: null,
  });
  assert.deepEqual(parseKasbonVerificationParams('?verifyKasbon=%20'), {
    tab: null,
    verifyKasbonId: null,
    refNumber: null,
  });
});

test('generateQrSvgString and generateQrDataUrl produce valid scannable QR assets locally', async () => {
  const link = buildKasbonVerificationUrl('http://localhost:3000', {
    id: 'dp-009',
    dpNumber: 'KSB-202611-009',
  });

  const svg = await generateQrSvgString(link, 200);
  assert.ok(svg.includes('<svg'));
  assert.ok(svg.includes('<path'));

  const dataUrl = await generateQrDataUrl(link, 300);
  assert.ok(dataUrl.startsWith('data:image/png;base64,'));
  assert.ok(dataUrl.length > 200);
});
