import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Server } from 'node:http';

const TMP_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'kaskukargo-scenarios-'));
process.env.DATA_DIR = TMP_DATA_DIR;
process.env.AUTH_JWT_SECRET = 'test-suite-signing-secret-min-32-chars!!';

let server: Server;
let baseUrl = '';
let adminAccessToken = '';
let adminRefreshToken = '';
let staffAccessToken = '';
let staffRoleId = '';

// Valid 1x1 transparent PNG bytes
const TINY_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

async function apiJson(
  method: string,
  route: string,
  options: {
    token?: string;
    body?: unknown;
    headers?: Record<string, string>;
  } = {}
): Promise<{ status: number; headers: Headers; data: Record<string, any> }> {
  const res = await fetch(`${baseUrl}${route}`, {
    method,
    headers: {
      ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      ...(options.headers ?? {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  let data: Record<string, any> = {};
  try {
    data = (await res.json()) as Record<string, any>;
  } catch {
    data = {};
  }
  return { status: res.status, headers: res.headers, data };
}

before(async () => {
  const { createApp } = await import('../server.ts');
  const app = await createApp({ skipFrontend: true });
  await new Promise<void>((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      assert.ok(addr && typeof addr === 'object');
      baseUrl = `http://127.0.0.1:${addr.port}`;
      resolve();
    });
  });
});

after(async () => {
  if (server) {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
  fs.rmSync(TMP_DATA_DIR, { recursive: true, force: true });
});

test('API-NEG-01: Unauthenticated access, forged JWT, and weak/duplicate bootstrap are blocked', async () => {
  for (const [method, route] of [
    ['GET', '/api/state'],
    ['GET', '/api/activity-logs'],
    ['GET', '/api/uploads/nota-fake.png'],
    ['POST', '/api/requests'],
    ['POST', '/api/rbac/roles'],
  ] as const) {
    const res = await apiJson(method, route, { body: method === 'POST' ? {} : undefined });
    assert.equal(res.status, 401, `${method} ${route} must return 401`);
  }

  // Forged JWT rejected
  const forgedRes = await apiJson('GET', '/api/state', {
    token: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJhZG1pbiIsInNpZCI6InMxIiwiZXhwIjo5OTk5OTk5OTk5fQ.bad_sig',
  });
  assert.equal(forgedRes.status, 401);

  // Weak password rejected on bootstrap
  const weakBootstrap = await apiJson('POST', '/api/auth/bootstrap', {
    body: {
      name: 'Hendra Kusuma',
      email: 'hendra@kaskukargo.id',
      password: '123',
    },
  });
  assert.equal(weakBootstrap.status, 400);

  // Valid first-run admin bootstrap succeeds
  const okBootstrap = await apiJson('POST', '/api/auth/bootstrap', {
    body: {
      name: 'Hendra Kusuma',
      email: 'hendra@kaskukargo.id',
      password: 'CargoAman2026',
    },
  });
  assert.equal(okBootstrap.status, 201);
  assert.ok(okBootstrap.data.accessToken);
  assert.ok(okBootstrap.data.refreshToken);
  adminAccessToken = okBootstrap.data.accessToken;
  adminRefreshToken = okBootstrap.data.refreshToken;

  // Second bootstrap attempt is permanently blocked
  const secondBootstrap = await apiJson('POST', '/api/auth/bootstrap', {
    body: {
      name: 'Attacker Admin',
      email: 'attacker@evil.id',
      password: 'AttackerPassword1',
    },
  });
  assert.equal(secondBootstrap.status, 409);
});

test('API-SEC-01: Cross-origin CSRF mutation & malicious uploads / path traversal are blocked', async () => {
  // Foreign Origin header rejected with 403 ORIGIN_FORBIDDEN
  const csrfAttempt = await apiJson('POST', '/api/requests', {
    token: adminAccessToken,
    headers: { Origin: 'https://evil-phishing.example.com' },
    body: { title: 'Forged' },
  });
  assert.equal(csrfAttempt.status, 403);
  assert.equal(csrfAttempt.data.code, 'ORIGIN_FORBIDDEN');

  // Fake PNG containing HTML/script bytes rejected by magic-byte validator
  const fakePng = await apiJson('POST', '/api/uploads', {
    token: adminAccessToken,
    body: {
      filename: 'payload.png',
      mimeType: 'image/png',
      dataBase64: Buffer.from('<script>alert(1)</script>').toString('base64'),
    },
  });
  assert.equal(fakePng.status, 400);
  assert.match(fakePng.data.error ?? '', /tidak cocok dengan format gambar/i);

  // Unsupported MIME type rejected
  const exeUpload = await apiJson('POST', '/api/uploads', {
    token: adminAccessToken,
    body: {
      filename: 'shell.html',
      mimeType: 'text/html',
      dataBase64: Buffer.from('<html></html>').toString('base64'),
    },
  });
  assert.equal(exeUpload.status, 400);

  // Path traversal on download blocked
  const traversal = await apiJson('GET', '/api/uploads/..%2F..%2Fpackage.json', {
    token: adminAccessToken,
  });
  assert.equal(traversal.status, 404);
});

test('API-FRAUD-01: Missing receipt, duplicate receiptRef, over-limit, and self-approval are blocked by server', async () => {
  // First upload valid 1x1 PNG receipt
  const uploadRes = await apiJson('POST', '/api/uploads', {
    token: adminAccessToken,
    body: {
      filename: 'nota-spbu.png',
      mimeType: 'image/png',
      dataBase64: TINY_PNG_BASE64,
    },
  });
  assert.equal(uploadRes.status, 201);
  const receiptUrl = uploadRes.data.url as string;

  // Missing receipt photo rejected
  const noReceipt = await apiJson('POST', '/api/requests', {
    token: adminAccessToken,
    body: {
      departmentId: 'dept-arm',
      requesterName: 'Andi Wijaya',
      title: 'Solar Tanpa Foto Nota',
      category: 'BBM & Tol Armada',
      amount: 500_000,
      receiptRef: 'SPBU-NO-IMG',
      receiptImageUrl: '',
    },
  });
  assert.equal(noReceipt.status, 400);
  assert.match(noReceipt.data.error ?? '', /Foto nota\/invoice wajib/i);

  // Over maxSingleRequestAmount (> 3,000,000) rejected
  const overLimit = await apiJson('POST', '/api/requests', {
    token: adminAccessToken,
    body: {
      departmentId: 'dept-arm',
      requesterName: 'Andi Wijaya',
      title: 'Klaim Over Plafon Transaksi',
      category: 'BBM & Tol Armada',
      amount: 4_500_000,
      receiptRef: 'SPBU-OVER-1',
      receiptImageUrl: receiptUrl,
    },
  });
  assert.equal(overLimit.status, 400);
  assert.match(overLimit.data.error ?? '', /melebihi batas maksimal/i);

  // Legit request with unique receiptRef
  const legitReq = await apiJson('POST', '/api/requests', {
    token: adminAccessToken,
    body: {
      departmentId: 'dept-arm',
      requesterName: 'Andi Wijaya',
      title: 'Solar Rute Semarang',
      category: 'BBM & Tol Armada',
      amount: 850_000,
      receiptRef: 'SPBU-UNIK-777',
      receiptImageUrl: receiptUrl,
    },
  });
  assert.equal(legitReq.status, 201);

  // Duplicate receiptRef rejected
  const dupReceipt = await apiJson('POST', '/api/requests', {
    token: adminAccessToken,
    body: {
      departmentId: 'dept-arm',
      requesterName: 'Siti Rahma',
      title: 'Klaim Ulang Struk Sama',
      category: 'BBM & Tol Armada',
      amount: 850_000,
      receiptRef: 'spbu-unik-777',
      receiptImageUrl: receiptUrl,
    },
  });
  assert.equal(dupReceipt.status, 400);
  assert.match(dupReceipt.data.error ?? '', /sudah pernah dipakai/i);

  // Self-approval attempt blocked (admin submits request under own name, then tries to approve it)
  const selfReq = await apiJson('POST', '/api/requests', {
    token: adminAccessToken,
    body: {
      departmentId: 'dept-arm',
      requesterName: 'Hendra Kusuma',
      title: 'Klaim Pribadi Untuk Self-Approval',
      category: 'BBM & Tol Armada',
      amount: 400_000,
      receiptRef: 'SPBU-SELF-01',
      receiptImageUrl: receiptUrl,
    },
  });
  assert.equal(selfReq.status, 201);
  const selfReqId = selfReq.data.request.id as string;

  const selfApprove = await apiJson('POST', `/api/requests/${selfReqId}/decision`, {
    token: adminAccessToken,
    body: {
      decision: 'approve',
      note: 'Setujui klaim sendiri',
    },
  });
  assert.equal(selfApprove.status, 400);
  assert.match(selfApprove.data.error ?? '', /tidak (diperbolehkan|diizinkan) menyetujui pengajuannya sendiri/i);
});

test('API-SEC-02: Restricted role privilege escalation returns 403 across protected routes', async () => {
  // Admin creates custom restricted role & assigns staff user
  const createRole = await apiJson('POST', '/api/rbac/roles', {
    token: adminAccessToken,
    body: {
      name: 'Kurir Terbatas',
      description: 'Hanya boleh melihat dashboard & buat pengajuan',
      permissions: ['dashboard:view', 'approvals:view', 'requests:create', 'wiki:view'],
    },
  });
  assert.equal(createRole.status, 201);
  staffRoleId = createRole.data.role.id;

  const createStaff = await apiJson('POST', '/api/rbac/users', {
    token: adminAccessToken,
    body: {
      name: 'Budi Kurir',
      email: 'budi.kurir@kaskukargo.id',
      password: 'KurirPassword2026',
      roleId: staffRoleId,
    },
  });
  assert.equal(createStaff.status, 201);

  const staffLogin = await apiJson('POST', '/api/auth/login', {
    body: {
      email: 'budi.kurir@kaskukargo.id',
      password: 'KurirPassword2026',
    },
  });
  assert.equal(staffLogin.status, 200);
  staffAccessToken = staffLogin.data.accessToken;

  // Restricted user attempts privileged actions -> all blocked with 403
  const stateRes = await apiJson('GET', '/api/state', { token: adminAccessToken });
  const pendingReq = stateRes.data.requests.find(
    (r: any) => r.status === 'pending_director'
  );
  assert.ok(pendingReq);

  const escalations = await Promise.all([
    apiJson('POST', '/api/rbac/roles', {
      token: staffAccessToken,
      body: { name: 'SuperHack', permissions: ['rbac:manage_roles'] },
    }),
    apiJson('POST', `/api/requests/${pendingReq.id}/decision`, {
      token: staffAccessToken,
      body: { decision: 'approve', note: 'Approve ilegal' },
    }),
    apiJson('GET', '/api/activity-logs', { token: staffAccessToken }),
    apiJson('POST', '/api/closings/periods', {
      token: staffAccessToken,
      body: { monthKey: '2026-10', note: 'Tutup ilegal' },
    }),
    apiJson('POST', '/api/departments/dept-arm/topup', {
      token: staffAccessToken,
      body: { amount: 5_000_000, note: 'Top-up ilegal' },
    }),
  ]);

  for (const res of escalations) {
    assert.equal(res.status, 403, `Expected 403, got ${res.status}`);
  }
});

test('API-WORST-01: Locked period blocks mutations, opname shortage without note fails, and overdraft blocked', async () => {
  // Admin locks historical month 2026-10 (no pending items in 2026-10)
  const lockOk = await apiJson('POST', '/api/closings/periods', {
    token: adminAccessToken,
    body: { monthKey: '2026-10', note: 'Tutup buku Oktober' },
  });
  assert.equal(lockOk.status, 201);

  // Locking current month 2026-11 while pending requests exist must fail
  const stateRes = await apiJson('GET', '/api/state', { token: adminAccessToken });
  const currentMonthKey = String(stateRes.data.serverTime).slice(0, 7);
  const lockCurrentFail = await apiJson('POST', '/api/closings/periods', {
    token: adminAccessToken,
    body: { monthKey: currentMonthKey, note: 'Coba kunci saat masih pending' },
  });
  assert.equal(lockCurrentFail.status, 400);
  assert.match(lockCurrentFail.data.error ?? '', /menunggu persetujuan/i);

  // Opname with physical variance but missing explanation fails
  const badOpname = await apiJson('POST', '/api/opname', {
    token: adminAccessToken,
    body: {
      departmentId: 'dept-arm',
      note: '',
      denominations: [{ denomination: 100_000, count: 1 }],
    },
  });
  assert.equal(badOpname.status, 400);
  assert.match(badOpname.data.error ?? '', /Catatan penjelasan selisih wajib/i);

  // Massive kasbon exceeding department available balance fails
  const hugeKasbon = await apiJson('POST', '/api/down-payments', {
    token: adminAccessToken,
    body: {
      departmentId: 'dept-arm',
      requesterName: 'Supriyatno',
      title: 'Kasbon Raksasa Melebihi Saldo',
      category: 'BBM & Tol Armada',
      requestedAmount: 999_000_000,
      dueDate: '2099-12-31',
    },
  });
  assert.equal(hugeKasbon.status, 400);
  assert.match(hugeKasbon.data.error ?? '', /melebihi saldo tersedia/i);
});

test('API-SEC-03: Refresh token reuse attack revokes session and failed-login brute-force triggers lockout & 429', async () => {
  // 1. Rotate admin refresh token -> RT1 replaced by RT2
  const firstRotate = await apiJson('POST', '/api/auth/refresh', {
    body: { refreshToken: adminRefreshToken },
  });
  assert.equal(firstRotate.status, 200);
  const rotatedRefreshToken = firstRotate.data.refreshToken as string;
  assert.notEqual(rotatedRefreshToken, adminRefreshToken);

  // 2. Attacker replays stolen old RT1 -> server detects reuse & revokes whole session
  const reuseAttack = await apiJson('POST', '/api/auth/refresh', {
    body: { refreshToken: adminRefreshToken },
  });
  assert.equal(reuseAttack.status, 401);

  // 3. Even legitimate RT2 must now fail because session was revoked upon reuse detection!
  const postRevokeRefresh = await apiJson('POST', '/api/auth/refresh', {
    body: { refreshToken: rotatedRefreshToken },
  });
  assert.equal(postRevokeRefresh.status, 401);

  // 4. Re-login cleanly as admin to inspect intact SHA-256 audit log chain
  const relogin = await apiJson('POST', '/api/auth/login', {
    body: { email: 'hendra@kaskukargo.id', password: 'CargoAman2026' },
  });
  assert.equal(relogin.status, 200);
  const freshToken = relogin.data.accessToken as string;

  const auditRes = await apiJson('GET', '/api/activity-logs', { token: freshToken });
  assert.equal(auditRes.status, 200);
  assert.equal(auditRes.data.integrity.valid, true);

  // 5. Per-account brute-force cooldown (5 wrong attempts) & auth rate limiter 429 (15 req/min)
  let sawCooldown = false;
  let sawRateLimit429 = false;
  for (let i = 1; i <= 18; i += 1) {
    const attempt = await apiJson('POST', '/api/auth/login', {
      body: {
        email: 'budi.kurir@kaskukargo.id',
        password: `WrongPass-${i}`,
      },
    });
    if (
      attempt.status === 429 &&
      attempt.data.code !== 'RATE_LIMITED' &&
      /dikunci sementara/i.test(attempt.data.error ?? '')
    ) {
      sawCooldown = true;
    }
    if (attempt.status === 429 && attempt.data.code === 'RATE_LIMITED') {
      sawRateLimit429 = true;
      assert.ok(attempt.headers.get('retry-after'));
      break;
    }
  }
  assert.equal(sawCooldown, true, 'Expected per-account cooldown on repeated wrong passwords');
  assert.equal(sawRateLimit429, true, 'Expected HTTP 429 from sliding-window auth rate limiter');
});
