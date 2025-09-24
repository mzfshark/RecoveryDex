// src/hooks/useTheme.js
import { useState, useEffect, useCallback } from 'react';

export function useTheme() {
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('theme');
    if (saved) {
      return saved;
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  const apply = useCallback((next) => {
    // Remove both possible classes first
    document.documentElement.classList.remove('dark', 'light');
    // Add the new theme class
    document.documentElement.classList.add(next);
    setTheme(next);
    console.log('Theme applied:', next, 'Classes:', document.documentElement.classList.toString());
  }, []);

  const toggle = useCallback(() => {
    const next = theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('theme', next);
    apply(next);
  }, [apply, theme]);

  // Sync class on mount and when theme changes
  useEffect(() => {
    // Remove both possible classes first
    document.documentElement.classList.remove('dark', 'light');
    // Add the current theme class
    document.documentElement.classList.add(theme);
    console.log('Initial theme setup:', theme, 'Classes:', document.documentElement.classList.toString());
    
    return () => {
      document.documentElement.classList.remove(theme);
    };
  }, [theme]);

  return { theme, toggle };
}
