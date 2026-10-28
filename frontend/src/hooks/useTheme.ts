import { useState, useEffect } from 'react';

export function useTheme() {
  // O tema escuro ("Carbono") está desligado em ConfiguracoesPage: as telas ainda não
  // suportam e ficavam ilegíveis. Até voltar, começa sempre claro — sem seguir o sistema
  // nem um 'dark' que tenha ficado salvo.
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    if (theme === 'dark') {
      document.body.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.body.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [theme]);

  const toggleTheme = () => setTheme(t => (t === 'light' ? 'dark' : 'light'));

  return { theme, toggleTheme, isDark: theme === 'dark' };
}
