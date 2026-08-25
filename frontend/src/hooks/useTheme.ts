import { useState, useEffect } from 'react';

export function useTheme() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    // No dark class handling; always keep light theme
    document.body.classList.remove('dark');
    localStorage.setItem('theme', 'light');
  }, []);

  const toggleTheme = () => {
    // No-op: theme switching disabled
    // setTheme(t => (t === 'light' ? 'dark' : 'light'));
  };

  return { theme, toggleTheme: () => {}, isDark: false };
}
