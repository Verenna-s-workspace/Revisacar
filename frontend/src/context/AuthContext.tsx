import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../utils/api';
import type { AuthResult } from '../types';

interface AuthContextProps {
  user: AuthResult | null;
  loading: boolean;
  login: (user: AuthResult) => void;
  logout: () => void;
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

  const value = {
    user,
    loading,
    login,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};