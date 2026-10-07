import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

const ThemeContext = createContext(null);

const THEME_STORAGE_KEY = 'sardar-pharmacy-theme';
const VALID_THEMES = ['light', 'dark', 'system'];

const getSystemTheme = () => {
  if (typeof window === 'undefined') {
    return 'light';
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
};

const getInitialTheme = () => {
  if (typeof window === 'undefined') {
    return 'system';
  }

  const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);

  return VALID_THEMES.includes(savedTheme) ? savedTheme : 'system';
};

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(getInitialTheme);
  const [systemTheme, setSystemTheme] = useState(getSystemTheme);

  const resolvedTheme = theme === 'system' ? systemTheme : theme;

  useEffect(() => {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleSystemThemeChange = (event) => {
      setSystemTheme(event.matches ? 'dark' : 'light');
    };

    mediaQuery.addEventListener('change', handleSystemThemeChange);

    return () => {
      mediaQuery.removeEventListener('change', handleSystemThemeChange);
    };
  }, []);

  useEffect(() => {
    const root = document.documentElement;

    root.classList.remove('light', 'dark');
    root.classList.add(resolvedTheme);

    root.setAttribute('data-theme', resolvedTheme);
    root.style.colorScheme = resolvedTheme;
  }, [resolvedTheme]);

  const setTheme = useCallback((newTheme) => {
    if (VALID_THEMES.includes(newTheme)) {
      setThemeState(newTheme);
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((currentTheme) => {
      if (currentTheme === 'dark') {
        return 'light';
      }

      if (currentTheme === 'light') {
        return 'dark';
      }

      return getSystemTheme() === 'dark' ? 'light' : 'dark';
    });
  }, []);

  const isDark = resolvedTheme === 'dark';
  const isLight = resolvedTheme === 'light';
  const isSystem = theme === 'system';

  const contextValue = useMemo(
    () => ({
      theme,
      resolvedTheme,
      systemTheme,
      isDark,
      isLight,
      isSystem,
      setTheme,
      toggleTheme,
      toggle: toggleTheme,
    }),
    [
      theme,
      resolvedTheme,
      systemTheme,
      isDark,
      isLight,
      isSystem,
      setTheme,
      toggleTheme,
    ]
  );

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
}

// The project intentionally keeps ThemeProvider and useTheme in one file.
 // eslint-disable-next-line react-refresh/only-export-components
export function useTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error('useTheme must be used inside ThemeProvider');
  }

  return context;
}