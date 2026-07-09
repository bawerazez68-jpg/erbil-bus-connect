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

export type Role = "passenger" | "owner" | "advertiser" | "auditor";

export type User = {
  id: string;
  name: string;
  email: string;
  role: Role;
};

type AuthResult = { user: User; accessToken: string; expiresInSec: number };

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

// Plain fetch against the /api/auth/* server routes — not createServerFn —
// because this project's import-protection config denies any
// client-reachable file (this one is imported by the root route) from
// importing anything under src/server/**, including createServerFn RPC
// wrapper files. Server ROUTES don't have that restriction, so the actual
// auth logic lives there; this file only ever talks to them over HTTP.
async function apiCall<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const message =
      body && typeof body === "object" && typeof body.error === "string"
        ? body.error
        : "Request failed";
    throw new Error(message);
  }
  return body as T;
}

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
      const result = await apiCall<AuthResult>("/api/auth/refresh", { method: "POST" });
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
      const result = await apiCall<AuthResult>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      setUser(result.user);
      setAccessToken(result.accessToken);
      scheduleRefresh(result.expiresInSec);
      return result.user;
    },
    [scheduleRefresh],
  );

  const signup = useCallback(
    async (name: string, email: string, password: string, role: Role) => {
      const result = await apiCall<AuthResult>("/api/auth/signup", {
        method: "POST",
        body: JSON.stringify({ name, email, password, role }),
      });
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
      await apiCall("/api/auth/logout", { method: "POST" });
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
