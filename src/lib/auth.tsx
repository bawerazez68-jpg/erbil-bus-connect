import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Role = "passenger" | "owner" | "advertiser";

export type User = {
  id: string;
  name: string;
  email: string;
  role: Role;
};

type Ctx = {
  user: User | null;
  login: (email: string, role: Role) => User;
  signup: (name: string, email: string, role: Role) => User;
  logout: () => void;
};

const AuthContext = createContext<Ctx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = localStorage.getItem("bbina_user");
    if (raw) {
      try {
        setUser(JSON.parse(raw));
      } catch {}
    }
  }, []);

  const persist = (u: User | null) => {
    setUser(u);
    if (typeof window !== "undefined") {
      if (u) localStorage.setItem("bbina_user", JSON.stringify(u));
      else localStorage.removeItem("bbina_user");
    }
  };

  const login = (email: string, role: Role) => {
    const u: User = {
      id: Math.random().toString(36).slice(2),
      name: email.split("@")[0],
      email,
      role,
    };
    persist(u);
    return u;
  };

  const signup = (name: string, email: string, role: Role) => {
    const u: User = { id: Math.random().toString(36).slice(2), name, email, role };
    persist(u);
    return u;
  };

  const logout = () => persist(null);

  return (
    <AuthContext.Provider value={{ user, login, signup, logout }}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}