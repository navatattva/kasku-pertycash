# Security Summary

**Reviewed Files**: 38
**Issues Resolved**: 8

### Issues Resolved
| Area | File | Line | What Was Happening | Impact | Status | How It Was Fixed |
|---|---|---|---|---|---|---|
| Missing Route Authentication | `server.ts` | 42 | Core API routes (`GET /api/state`, `GET /api/stream`, and all `/api/*` mutations) accepted requests without verifying a signed-in user session. | High | Fixed | Enforced `authenticateRequest` across all `/api/*` state, stream, upload, and mutation routes, and added a first-run Director setup flow (`/api/auth/bootstrap`) when no user exists. |
| Missing Role & Action Authorization | `server/middleware/authMiddleware.ts` | 150 | Role switcher existed only on the client, and endpoints trusted client-supplied role/actor names without checking server-side permissions. | High | Fixed | Added `requirePermission(...)` middleware validating dynamic RBAC permissions (`PermissionKey`) from the authenticated user's assigned role and deriving actor identity from `req.auth.user`. |
| Unauthenticated Receipt File Access & Upload Validation | `server/routes/uploadsRoutes.ts` | 37 | Receipt downloads and uploads lacked authentication checks, upload rate limiting, and strict magic-byte/path confinement guards. | High | Fixed | Added `authenticateRequest`, `uploadRateLimiterMiddleware`, permission enforcement on `POST /api/uploads`, magic-byte verification, and strict regex + directory containment in `server/services/uploadsService.ts`. |
| Unbounded Authentication & API Requests | `server/middleware/rateLimiter.ts` | 45 | Login, token refresh, and API endpoints had no sliding-window rate limits or per-account brute-force lockouts. | Medium | Fixed | Added `SlidingWindowRateLimiter` on auth, upload, and general API routes (returning HTTP `429` with `Retry-After` and `X-RateLimit-*` headers) plus per-account failed-login cooldowns. |
| Spreadsheet Formula Injection in CSV Exports | `src/utils/logic/constants.ts` | 97 | Exported CSV cells starting with `=`, `+`, `-`, `@`, tab, or carriage return could be interpreted as formulas when opened in spreadsheet software. | Medium | Fixed | Added `escapeCsvCell` to prefix dangerous string formula triggers with `'` and safely quote CSV cells across Monthly, Armada, Ledger, and Audit Log exports. |
| Unvalidated External Link Scheme | `src/components/WhatsAppView.tsx` | 26 | Dynamic WhatsApp links were bound directly into `<a href>` attributes without validating the URL scheme. | Low | Fixed | Added `safeWaHref` allowing only `https://wa.me/<digits>` URLs before rendering external links. |
| Unmatched API Path HTML Fallback | `server.ts` | 59 | Requests to nonexistent `/api/*` endpoints fell through to the SPA HTML fallback (`200 OK`) instead of returning a proper API error. | Low | Fixed | Added an explicit `/api` catch-all returning JSON `404` before Vite/static SPA middleware. |
| Cross-Origin Mutation & Missing Security Headers | `server/middleware/securityHeaders.ts` | 14 | Responses lacked standard browser hardening headers and strict same-origin validation on mutating API calls. | Medium | Fixed | Applied `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `no-store` API cache control, and strict `Origin`/`Host` validation on mutating requests while omitting `X-Frame-Options` for iframe preview compatibility. |

### Safeguards Verified
| Area | File | How It's Protected |
|---|---|---|
| Password Hashing & Verification | `server/services/authService.ts` | Passwords are hashed with per-user random salts via Node `crypto.scryptSync` and verified with `crypto.timingSafeEqual`; password hashes and token digests are stripped from all API responses and SSE snapshots. |
| Session & Refresh Token Rotation | `src/hooks/useAuthSession.ts` | Short-lived HMAC-SHA256 access tokens and opaque refresh tokens are held strictly in JavaScript/React memory (`localStorage` and `sessionStorage` remain empty), rotated single-use via `POST /api/auth/refresh` with reuse detection, and automatically terminated on TTL expiry or admin revocation. |
| Path Traversal & Upload Safety | `server/services/uploadsService.ts` | Receipt uploads require JPG/PNG/WEBP magic bytes (max 4 MB), generate UUID filenames, and confine downloads strictly to `UPLOAD_DIR` via regex allowlisting and `path.resolve` prefix checks. |
| Tamper-Evident Audit Trail | `server/services/activityLogService.ts` | Every approval, rejection, login, failed login, token refresh, logout, forced revocation, and RBAC change is recorded append-only with UTC timestamp, verified actor, and SHA-256 hash chaining. |

---

## PoC Verification

### 1. Unauthenticated API & Receipt Access Blocked

#### Summary
| Field | Value |
|---|---|
| Issue Type | Missing Authentication Check |
| Impact | High |
| Affected File | `server.ts:42`, `server/routes/uploadsRoutes.ts:37` |
| Test Scenario | Unauthenticated `GET /api/state`, `GET /api/activity-logs`, `GET /api/uploads/test.png`, `POST /api/requests`, and `POST /api/rbac/roles` sent without an `Authorization: Bearer` header. |

#### How It Was Fixed
Added `authenticateRequest` middleware (`server/middleware/authMiddleware.ts:36`) before every protected route handler and verified signed HMAC-SHA256 access tokens against active, non-revoked sessions.

#### Step-by-Step Trace
| Step | What Happens in the Code | Outcome |
|---|---|---|
| 1 | Unauthenticated requests arrive at `/api/state`, `/api/activity-logs`, `/api/uploads/test.png`, `/api/requests`, and `/api/rbac/roles` | Requests enter `authenticateRequest` |
| 2 | `extractBearerToken(req)` at `server/middleware/authMiddleware.ts:41` finds no Bearer token | Middleware aborts request before handler execution |
| 3 | Final HTTP response returned (`curl` verified `401` on all five routes, and `404` on unknown `/api/unknown-route`) | **Handled Safely (`401 Unauthorized`)** |

#### Conclusion
**Fix Verified** - No application state, audit logs, uploaded receipts, or mutating actions are reachable without a valid authenticated session.

---

### 2. Server-Side Dynamic RBAC Privilege Escalation Blocked

#### Summary
| Field | Value |
|---|---|
| Issue Type | Broken Function-Level Access Control |
| Impact | High |
| Affected File | `server/middleware/authMiddleware.ts:150`, `server/routes/rbacRoutes.ts:19` |
| Test Scenario | Authenticated user assigned custom role `Kepala Pool` (only `dashboard:view`, `approvals:view`, `requests:create`, `wiki:view`) sends `POST /api/rbac/roles` attempting to create an admin role and `GET /api/activity-logs` to read security audit records. |

#### How It Was Fixed
Each endpoint chains `authenticateRequest` with `requirePermission(...)`, which resolves live role permissions on the server from `req.auth.role` and rejects missing permissions with HTTP `403`. UI views (`Sidebar.tsx`, `ApprovalQueueView.tsx`, `RbacManagementView.tsx`, etc.) also hide unauthorized menus and controls.

#### Step-by-Step Trace
| Step | What Happens in the Code | Outcome |
|---|---|---|
| 1 | Authenticated `Kepala Pool` Bearer token arrives at `POST /api/rbac/roles` (`server/routes/rbacRoutes.ts:20`) and `GET /api/activity-logs` | `authenticateRequest` populates `req.auth.permissions` |
| 2 | `requirePermission('rbac:manage_roles')` checks `hasPermission(req.auth.permissions, 'rbac:manage_roles')` | Permission check returns `false` |
| 3 | Server responds with HTTP `403 Forbidden` (verified via live `curl` check against running server) | **Handled Safely (`403 Forbidden`)** |

#### Conclusion
**Fix Verified** - Restricted roles cannot escalate privileges or access protected audit logs even when sending forged API requests directly.

---

### 3. Authentication Rate Limiter & Per-Account Cooldown

#### Summary
| Field | Value |
|---|---|
| Issue Type | Missing Brute-Force & Request Rate Limiting |
| Impact | Medium |
| Affected File | `server/middleware/rateLimiter.ts:45`, `src/utils/logic/rateLimiter.ts:19` |
| Test Scenario | 18 rapid `POST /api/auth/login` requests sent with invalid credentials within 60 seconds against the default 15 req/min auth limit. |

#### How It Was Fixed
Added `SlidingWindowRateLimiter` (`src/utils/logic/rateLimiter.ts:19`) enforced by `authRateLimiterMiddleware` (`server/middleware/rateLimiter.ts:45`) and configurable dynamically via `securityPolicy`.

#### Step-by-Step Trace
| Step | What Happens in the Code | Outcome |
|---|---|---|
| 1 | Requests #1–#15 hit `POST /api/auth/login` from the same client IP | Counted in `authLimiter` sliding 60s window |
| 2 | Request #16 exceeds `memoryDb.securityPolicy.authRateLimitMaxPerMinute` (`15`) at `server/middleware/rateLimiter.ts:55` | `result.allowed` returns `false` with `retryAfterSec: 60` |
| 3 | Server returns HTTP `429 Too Many Requests` with `X-RateLimit-Limit: 15`, `X-RateLimit-Remaining: 0`, and `Retry-After: 60` | **Handled Safely (`429 Rate Limited`)** |

#### Conclusion
**Fix Verified** - Rapid credential-guessing bursts are throttled immediately at the server boundary.

---

### 4. CSV Formula Injection Neutralization

#### Summary
| Field | Value |
|---|---|
| Issue Type | Spreadsheet Formula Injection |
| Impact | Medium |
| Affected File | `src/utils/logic/constants.ts:97`, `src/utils/logic/activityLog.ts:287` |
| Test Scenario | Exporting string cells containing spreadsheet formula payloads `=SUM(A1:A2)`, `+cmd|"calc"!A0`, `@evil`, and `-250000` alongside negative numeric values `-250000`. |

#### How It Was Fixed
Implemented `escapeCsvCell` (`src/utils/logic/constants.ts:97`) to prepend `'` to string values beginning with `=`, `+`, `-`, `@`, `\t`, or `\r` while keeping genuine numeric values intact.

#### Step-by-Step Trace
| Step | What Happens in the Code | Outcome |
|---|---|---|
| 1 | Payload string `=SUM(A1:A2)` or `+cmd|"calc"!A0` passes into `escapeCsvCell` during report/audit CSV export | Leading formula trigger character matched |
| 2 | `escapeCsvCell` prefixes `'` and wraps quotes/escaped quotes where required | Dangerous formula neutralized to plain literal text |
| 3 | Unit test (`src/utils/pettycashLogic.test.ts:1398`) verifies `'=SUM(A1:A2)` and `\"'+cmd|\"\"calc\"\"!A0\"` output | **Handled Safely** |

#### Conclusion
**Fix Verified** - Exported CSV reports and audit logs cannot execute formulas when opened in Excel or Google Sheets.
