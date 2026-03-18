export type Theme = 'dark' | 'light';

function createThemeStore() {
  let theme = $state<Theme>('dark');

  function apply(t: Theme) {
    theme = t;
    document.documentElement.dataset.theme = t;
  }

  return {
    get theme() { return theme; },
    set theme(t: Theme) { apply(t); },
    toggle() { apply(theme === 'dark' ? 'light' : 'dark'); },
  };
}

export const themeStore = createThemeStore();
