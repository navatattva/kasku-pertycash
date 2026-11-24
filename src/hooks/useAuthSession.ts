import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ApiError,
  getRefreshTokenInMemory,
  pettycashApi,
  refreshAuthTokensSingleFlight,
  registerAuthRefreshHooks,
  setAuthTokensInMemory,
} from '../api/pettycashApi.ts';
import type { NavTab } from '../components/Sidebar.tsx';
import type {
  AuthStatusInfo,
  AuthTokenBundle,
  PermissionKey,
  RbacRole,
} from '../types/pettycash.ts';

interface UseAuthSessionOptions {
  onLoginSuccessRestoreTab: (
    lastVisitedTab: string,
    permissions: PermissionKey[]
  ) => void;
}

export function useAuthSession({
  onLoginSuccessRestoreTab,
}: UseAuthSessionOptions) {
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [authStatus, setAuthStatus] = useState<AuthStatusInfo | null>(null);
  const [statusError, setStatusError] = useState('');
  const [sessionBundle, setSessionBundle] = useState<AuthTokenBundle | null>(
    null
  );
  const [expiredNotice, setExpiredNotice] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [remainingAccessSeconds, setRemainingAccessSeconds] = useState(0);
  const [remainingSessionSeconds, setRemainingSessionSeconds] = useState(0);

  const autoLogoutLockRef = useRef(false);
  const refreshLockRef = useRef(false);

  const loadAuthStatus = useCallback(async () => {
    try {
      setCheckingStatus(true);
      setStatusError('');
      const info = await pettycashApi.auth.getStatus();
      setAuthStatus(info);
    } catch (err) {
      setStatusError(
        err instanceof Error
          ? err.message
          : 'Gagal terhubung ke layanan autentikasi.'
      );
    } finally {
      setCheckingStatus(false);
    }
  }, []);

  useEffect(() => {
    loadAuthStatus();
  }, [loadAuthStatus]);

  const clearSessionState = useCallback(
    (noticeMessage?: string) => {
      setAuthTokensInMemory(null, null);
      setSessionBundle(null);
      setRemainingAccessSeconds(0);
      setRemainingSessionSeconds(0);
      if (noticeMessage) {
        setExpiredNotice(noticeMessage);
      }
      loadAuthStatus();
    },
    [loadAuthStatus]
  );

  useEffect(() => {
    return registerAuthRefreshHooks({
      onTokensRefreshed: (nextBundle) => {
        setSessionBundle(nextBundle);
      },
      onSessionExpired: (message) => {
        clearSessionState(
          message ||
            'Sesi Anda telah berakhir. Silakan login kembali untuk melanjutkan.'
        );
      },
    });
  }, [clearSessionState]);

  const applyAuthenticatedBundle = useCallback(
    (bundle: AuthTokenBundle) => {
      autoLogoutLockRef.current = false;
      setExpiredNotice('');
      setAuthTokensInMemory(bundle.accessToken, bundle.refreshToken);
      setSessionBundle(bundle);
      setAuthStatus((prev) =>
        prev ? { ...prev, needsInitialSetup: false } : prev
      );
      onLoginSuccessRestoreTab(bundle.user.lastVisitedTab, bundle.permissions);
    },
    [onLoginSuccessRestoreTab]
  );

  const bootstrapAdmin = useCallback(
    async (payload: {
      name: string;
      email: string;
      password: string;
      passcode?: string;
    }): Promise<{ ok: boolean; error?: string }> => {
      try {
        const bundle = await pettycashApi.auth.bootstrap(payload);
        applyAuthenticatedBundle(bundle);
        return { ok: true };
      } catch (err) {
        return {
          ok: false,
          error:
            err instanceof ApiError
              ? err.message
              : 'Gagal menyelesaikan setup admin awal.',
        };
      }
    },
    [applyAuthenticatedBundle]
  );

  const login = useCallback(
    async (payload: {
      email: string;
      password: string;
    }): Promise<{ ok: boolean; error?: string }> => {
      try {
        const bundle = await pettycashApi.auth.login(payload);
        applyAuthenticatedBundle(bundle);
        return { ok: true };
      } catch (err) {
        return {
          ok: false,
          error:
            err instanceof ApiError ? err.message : 'Gagal masuk ke sistem.',
        };
      }
    },
    [applyAuthenticatedBundle]
  );

  const refreshNow = useCallback(async (): Promise<{
    ok: boolean;
    error?: string;
  }> => {
    if (!getRefreshTokenInMemory() || refreshLockRef.current) {
      return { ok: false };
    }
    refreshLockRef.current = true;
    setIsRefreshing(true);
    try {
      const ok = await refreshAuthTokensSingleFlight();
      if (!ok) {
        return { ok: false, error: 'Refresh token sudah habis atau dicabut.' };
      }
      return { ok: true };
    } finally {
      refreshLockRef.current = false;
      setIsRefreshing(false);
    }
  }, []);

  const logout = useCallback(
    async (
      reason: 'manual' | 'expired' = 'manual',
      notice?: string,
      skipServerCall = false
    ) => {
      if (autoLogoutLockRef.current && reason === 'expired') return;
      autoLogoutLockRef.current = true;
      try {
        if (!skipServerCall) {
          await pettycashApi.auth.logout(reason);
        }
      } catch {
        // Ignore network errors if token already expired
      } finally {
        clearSessionState(notice);
      }
    },
    [clearSessionState]
  );

  // Live countdown + proactive refresh + automatic logout on expiry
  useEffect(() => {
    if (!sessionBundle) return;

    const accessExpMs = new Date(sessionBundle.accessTokenExpiresAt).getTime();
    const sessionExpMs = new Date(
      sessionBundle.refreshTokenExpiresAt
    ).getTime();
    const totalAccessSpan = Math.max(10_000, accessExpMs - Date.now());
    const refreshThresholdMs = Math.min(25_000, Math.floor(totalAccessSpan * 0.25));

    const evaluateTimers = () => {
      const nowMs = Date.now();
      const sessionRemMs = sessionExpMs - nowMs;
      const accessRemMs = accessExpMs - nowMs;

      setRemainingSessionSeconds(Math.max(0, Math.ceil(sessionRemMs / 1000)));
      setRemainingAccessSeconds(Math.max(0, Math.ceil(accessRemMs / 1000)));

      if (sessionRemMs <= 0) {
        logout(
          'expired',
          'Sesi Anda telah habis secara otomatis (TTL sesi berakhir). Silakan login kembali.'
        );
        return;
      }

      if (accessRemMs <= refreshThresholdMs && !refreshLockRef.current) {
        refreshNow();
      }
    };

    evaluateTimers();
    const timer = window.setInterval(evaluateTimers, 1_000);
    const onWake = () => {
      if (document.visibilityState === 'visible') {
        evaluateTimers();
      }
    };
    window.addEventListener('focus', evaluateTimers);
    document.addEventListener('visibilitychange', onWake);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', evaluateTimers);
      document.removeEventListener('visibilitychange', onWake);
    };
  }, [sessionBundle, logout, refreshNow]);

  const syncLastVisitedTab = useCallback(
    async (tab: NavTab) => {
      if (!sessionBundle) return;
      try {
        await pettycashApi.auth.updateLastTab(tab);
      } catch {
        // Non-blocking background sync
      }
    },
    [sessionBundle]
  );

  const syncLiveRolesFromSnapshot = useCallback((roles: RbacRole[]) => {
    setSessionBundle((prev) => {
      if (!prev) return prev;
      const matched = roles.find((r) => r.id === prev.role.id);
      if (!matched) return prev;
      const unchanged =
        matched.updatedAt === prev.role.updatedAt &&
        matched.name === prev.role.name &&
        matched.permissions.length === prev.permissions.length;
      if (unchanged) return prev;
      return {
        ...prev,
        role: matched,
        permissions: matched.permissions,
        user: {
          ...prev.user,
          roleName: matched.name,
        },
      };
    });
  }, []);

  return {
    checkingStatus,
    authStatus,
    statusError,
    reloadAuthStatus: loadAuthStatus,
    sessionBundle,
    isAuthenticated: Boolean(sessionBundle),
    expiredNotice,
    clearExpiredNotice: useCallback(() => setExpiredNotice(''), []),
    remainingAccessSeconds,
    remainingSessionSeconds,
    isRefreshing,
    bootstrapAdmin,
    login,
    refreshNow,
    logout,
    syncLastVisitedTab,
    syncLiveRolesFromSnapshot,
  };
}
