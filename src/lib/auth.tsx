import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  login as loginFn,
  signup as signupFn,
  refresh as refreshFn,
  logout as logoutFn,
} from "@/server/auth.functions";

export type Role = "passenger" | "owner" | "advertiser" | "auditor";

export type User = {
  id: string;
  name: string;
  email: string;
  role: Role;
};

type Ctx = {
  user: User | null;
  /** Short-lived JWT, kept in memory only (never localStorage) so an XSS bug can't read it from storage. */
  accessToken: string | null;
  /** True until the initial silent-refresh attempt (via the httpOnly refresh cookie) resolves. */
  isLoading: boolean;
  login: (email: string, password: string) => Promise<User>;
  signup: (name: string, email: string, password: string, role: Role) => Promise<User>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<Ctx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleRefresh = useCallback((expiresInSec: number) => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    // Refresh at 80% of the access token lifetime so it never expires
    // mid-session under normal use.
    const delayMs = Math.max(expiresInSec * 0.8, 5) * 1000;
    refreshTimer.current = setTimeout(() => {
      void silentRefresh();
    }, delayMs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const silentRefresh = useCallback(async () => {
    try {
      const result = await refreshFn();
      setUser(result.user);
      setAccessToken(result.accessToken);
      scheduleRefresh(result.expiresInSec);
    } catch {
      setUser(null);
      setAccessToken(null);
    }
  }, [scheduleRefresh]);

  useEffect(() => {
    silentRefresh().finally(() => setIsLoading(false));
    return () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const result = await loginFn({ data: { email, password } });
      setUser(result.user);
      setAccessToken(result.accessToken);
      scheduleRefresh(result.expiresInSec);
      return result.user;
    },
    [scheduleRefresh],
  );

  const signup = useCallback(
    async (name: string, email: string, password: string, role: Role) => {
      const result = await signupFn({ data: { name, email, password, role } });
      setUser(result.user);
      setAccessToken(result.accessToken);
      scheduleRefresh(result.expiresInSec);
      return result.user;
    },
    [scheduleRefresh],
  );

  const logout = useCallback(async () => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    try {
      await logoutFn();
    } finally {
      setUser(null);
      setAccessToken(null);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, accessToken, isLoading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

/** Redirects away from a role-gated page if the session is missing or the role doesn't match. */
export function useRequireRole(requiredRole: Role) {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      navigate({ to: "/login" });
      return;
    }
    if (user.role !== requiredRole) {
      navigate({ to: `/${user.role}` as "/passenger" | "/owner" | "/advertiser" | "/auditor" });
    }
  }, [user, isLoading, requiredRole, navigate]);

  return { user, isLoading };
}
