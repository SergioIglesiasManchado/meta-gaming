import { defineStore } from 'pinia';
import { ref } from 'vue';

export type Theme = 'light' | 'dark';

const getInitialTheme = (): Theme => {
  try {
    return window.localStorage.getItem('mg_theme') === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
};

export const useSettingsStore = defineStore('settings', () => {
  const theme = ref<Theme>(getInitialTheme());

  const setTheme = (nextTheme: Theme) => {
    theme.value = nextTheme;
    try {
      window.localStorage.setItem('mg_theme', nextTheme);
    } catch {
      // Keep the in-memory preference when browser storage is unavailable.
    }
  };

  const toggleTheme = () => {
    setTheme(theme.value === 'dark' ? 'light' : 'dark');
  };

  return { theme, setTheme, toggleTheme };
});
