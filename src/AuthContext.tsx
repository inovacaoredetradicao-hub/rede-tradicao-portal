import React, { createContext, useContext, useEffect, useState } from 'react';
import { loginPortalUser } from '@/services/portalAuditApi';
import { UserProfile, UserRole } from '@/types';

const STORAGE_KEY = 'portal-auditoria:session';

interface AuthContextType {
  profile: UserProfile | null;
  isAuthReady: boolean;
  loading: boolean;
  error: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function normalizeRole(role: string): UserRole {
  return role === 'admin' ? 'admin' : 'auditor';
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setProfile(JSON.parse(stored) as UserProfile);
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    } finally {
      setIsAuthReady(true);
    }
  }, []);

  const login = async (username: string, password: string) => {
    setLoading(true);
    setError(null);

    try {
      const user = await loginPortalUser(username, password);
      const nextProfile: UserProfile = {
        id: user.id,
        displayName: user.name,
        username: user.username,
        role: normalizeRole(user.role),
        isMaster: Boolean(user.isMaster),
        token: user.token,
      };

      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextProfile));
      setProfile(nextProfile);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Nao foi possivel entrar.';
      setError(message);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem(STORAGE_KEY);
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{ profile, isAuthReady, loading, error, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider.');
  }
  return context;
}
