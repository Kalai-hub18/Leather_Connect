import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { login as apiLogin, session, type AuthUser } from '../api/client';

interface AuthValue {
  user: AuthUser | null;
  signIn: (email: string, password: string) => Promise<AuthUser>;
  signOut: () => void;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => session.user);

  const signIn = useCallback(async (email: string, password: string) => {
    const u = await apiLogin(email, password);
    setUser(u);
    return u;
  }, []);

  const signOut = useCallback(() => {
    session.clear();
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, signIn, signOut }), [user, signIn, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

/** Where each role lands after signing in. */
export const HOME_BY_ROLE: Record<AuthUser['role'], string> = {
  STUDENT: '/student/jobs',
  HR: '/hr/jobs',
  PLACEMENT_OFFICER: '/officer/approvals',
  STUDENT_COORDINATOR: '/cell/roster',
  ALUMNI: '/alumni/endorse',
  COLLEGE_ADMIN: '/officer/approvals',
  SUPER_ADMIN: '/officer/approvals',
};
