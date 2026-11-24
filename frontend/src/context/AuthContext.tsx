import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../utils/api';
import type { AuthResult } from '../types';

interface AuthContextProps {
  user: AuthResult | null;
  loading: boolean;
  login: (user: AuthResult) => void;
  logout: () => void;
  /** Troca o nome de quem está logado (e o token, que leva o nome) sem sair da sessão. */
  atualizarNome: (nome: string, accessToken?: string) => void;
}

const AuthContext = createContext<AuthContextProps | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<AuthResult | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    // Check for existing token in localStorage
    const storedUser = localStorage.getItem('revisacarUser');
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        setUser(parsed);
        // Set the token in our API service
        if (parsed.accessToken) {
          api.setAuthTokens(parsed.accessToken, parsed.refreshToken);
        }
      } catch (e) {
        console.error('Failed to parse user from localStorage', e);
      }
    }
    setLoading(false);
  }, []);

  // Renovação de token: grava o par novo (senão recarregar volta com um refresh já invalidado)
  // e, se a sessão acabou de vez, sai — em vez de deixar o painel com cara de logado e todo vazio.
  useEffect(() => {
    api.aoRenovarSessao(
      (accessToken, refreshToken) => {
        setUser(atual => {
          if (!atual) return atual;
          const novo = { ...atual, accessToken, refreshToken };
          localStorage.setItem('revisacarUser', JSON.stringify(novo));
          return novo;
        });
      },
      () => {
        setUser(null);
        localStorage.removeItem('revisacarUser');
      },
      () => {
        try { return JSON.parse(localStorage.getItem('revisacarUser') || 'null'); } catch { return null; }
      },
    );
  }, []);

  const login = (userData: AuthResult) => {
    setUser(userData);
    localStorage.setItem('revisacarUser', JSON.stringify(userData));
    api.setAuthTokens(userData.accessToken, userData.refreshToken);
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('revisacarUser');
    api.clearAuthTokens();
  };

  // Mesmo padrão da renovação de token: parte do estado mais recente (não de uma cópia velha), para
  // não regravar um refresh token que uma renovação acabou de trocar.
  const atualizarNome = (nome: string, accessToken?: string) => {
    setUser(atual => {
      if (!atual) return atual;
      const novo = { ...atual, nome, accessToken: accessToken ?? atual.accessToken };
      localStorage.setItem('revisacarUser', JSON.stringify(novo));
      api.setAuthTokens(novo.accessToken, novo.refreshToken);
      return novo;
    });
  };

  const value = {
    user,
    loading,
    login,
    logout,
    atualizarNome,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};