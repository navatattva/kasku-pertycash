import { useState } from 'react';
import {
  AlertTriangle,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  ShieldCheck,
  UserPlus,
} from 'lucide-react';
import type { AuthStatusInfo } from '../types/pettycash.ts';

interface AuthScreenProps {
  authStatus: AuthStatusInfo | null;
  checkingStatus: boolean;
  statusError: string;
  expiredNotice: string;
  onRetryStatus: () => void;
  onLogin: (payload: {
    email: string;
    password: string;
  }) => Promise<{ ok: boolean; error?: string }>;
  onBootstrap: (payload: {
    name: string;
    email: string;
    password: string;
    passcode?: string;
  }) => Promise<{ ok: boolean; error?: string }>;
}

export function AuthScreen({
  authStatus,
  checkingStatus,
  statusError,
  expiredNotice,
  onRetryStatus,
  onLogin,
  onBootstrap,
}: AuthScreenProps) {
  const [name, setName] = useState('Hendra Kusuma');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passcode, setPasscode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const isSetupMode = Boolean(authStatus?.needsInitialSetup);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (isSetupMode) {
      if (password !== confirmPassword) {
        setError('Konfirmasi kata sandi tidak cocok.');
        return;
      }
      setSubmitting(true);
      const res = await onBootstrap({
        name,
        email,
        password,
        passcode: authStatus?.hasEnvAdminPasscode ? passcode : undefined,
      });
      setSubmitting(false);
      if (!res.ok) setError(res.error || 'Gagal mengaktifkan akun admin.');
      return;
    }

    setSubmitting(true);
    const res = await onLogin({ email, password });
    setSubmitting(false);
    if (!res.ok) setError(res.error || 'Login gagal.');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center px-4 py-10">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-700 text-white font-display text-xl font-bold shadow-sm">
            K
          </div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900">
            KasKu Kargo
          </h1>
          <p className="text-xs text-slate-500">
            Sistem Manajemen Petty Cash & Approval Terkontrol · Akses Terautentikasi
          </p>
        </div>

        {expiredNotice && (
          <div
            role="alert"
            className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 flex items-start gap-2.5 text-xs text-amber-900"
          >
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Sesi Berakhir Otomatis</p>
              <p className="mt-0.5 leading-relaxed">{expiredNotice}</p>
            </div>
          </div>
        )}

        {checkingStatus ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center space-y-3 shadow-sm">
            <div className="h-6 w-6 mx-auto rounded-full border-2 border-emerald-700 border-t-transparent animate-spin" />
            <p className="text-xs text-slate-500">
              Memeriksa status keamanan server...
            </p>
          </div>
        ) : statusError ? (
          <div className="rounded-2xl border border-rose-200 bg-white p-6 text-center space-y-3 shadow-sm">
            <p className="text-xs font-semibold text-rose-700">{statusError}</p>
            <button
              type="button"
              onClick={onRetryStatus}
              className="rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800"
            >
              Coba Hubungkan Ulang
            </button>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-7 shadow-sm space-y-5"
          >
            <div className="flex items-start gap-3 border-b border-slate-100 pb-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                {isSetupMode ? (
                  <UserPlus className="h-4 w-4" />
                ) : (
                  <Lock className="h-4 w-4" />
                )}
              </div>
              <div>
                <h2 className="font-display text-base font-bold text-slate-900">
                  {isSetupMode
                    ? 'Aktivasi Direktur Pertama (Setup Awal)'
                    : 'Masuk ke Akun Anda'}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                  {isSetupMode
                    ? 'Belum ada akun terdaftar. Buat akun Direktur (Super Admin) pertama untuk mengamankan aplikasi.'
                    : 'Masuk menggunakan email dan kata sandi. Anda akan diarahkan ke halaman terakhir yang diakses.'}
                </p>
              </div>
            </div>

            {error && (
              <div
                role="alert"
                className="rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-800"
              >
                {error}
              </div>
            )}

            <div className="space-y-4">
              {isSetupMode && (
                <div>
                  <label
                    htmlFor="auth-name"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    Nama Lengkap Direktur / Admin
                  </label>
                  <input
                    id="auth-name"
                    type="text"
                    required
                    minLength={2}
                    maxLength={80}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Contoh: Hendra Kusuma"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-700/20"
                  />
                </div>
              )}

              <div>
                <label
                  htmlFor="auth-email"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Alamat Email Perusahaan
                </label>
                <input
                  id="auth-email"
                  type="email"
                  required
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nama@kaskukargo.id"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-700/20"
                />
              </div>

              <div>
                <label
                  htmlFor="auth-password"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Kata Sandi
                </label>
                <div className="relative">
                  <input
                    id="auth-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={isSetupMode ? 8 : 1}
                    autoComplete={isSetupMode ? 'new-password' : 'current-password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={
                      isSetupMode
                        ? 'Minimal 8 karakter (huruf & angka)'
                        : 'Masukkan kata sandi'
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 pr-10 text-sm text-slate-900 focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-700/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={
                      showPassword ? 'Sembunyikan kata sandi' : 'Lihat kata sandi'
                    }
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {isSetupMode && (
                <div>
                  <label
                    htmlFor="auth-confirm-password"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    Konfirmasi Kata Sandi
                  </label>
                  <input
                    id="auth-confirm-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={8}
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Ulangi kata sandi"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-700/20"
                  />
                </div>
              )}

              {isSetupMode && authStatus?.hasEnvAdminPasscode && (
                <div>
                  <label
                    htmlFor="auth-bootstrap-passcode"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    Passcode Aktivasi Server
                  </label>
                  <input
                    id="auth-bootstrap-passcode"
                    type="password"
                    required
                    value={passcode}
                    onChange={(e) => setPasscode(e.target.value)}
                    placeholder="Masukkan ADMIN_BOOTSTRAP_PASSCODE"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-700/20"
                  />
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60 transition-colors"
            >
              <KeyRound className="h-4 w-4" />
              <span>
                {submitting
                  ? 'Memproses...'
                  : isSetupMode
                  ? 'Aktifkan Akun Super Admin & Masuk'
                  : 'Masuk ke KasKu Kargo'}
              </span>
            </button>

            <div className="rounded-lg bg-slate-50 border border-slate-200 px-3.5 py-2.5 flex items-start gap-2 text-[11px] text-slate-600">
              <ShieldCheck className="h-4 w-4 text-emerald-700 shrink-0 mt-0.5" />
              <span>
                Dilindungi rotasi Refresh Token, Rate Limiter anti-bruteforce, RBAC dinamis, dan Audit Trail SHA-256.
              </span>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
