try {
  const saved = JSON.parse(localStorage.getItem('struct-launcher-web-v1') || '{}').theme;
  const theme = localStorage.getItem('struct-launcher-native-theme') || saved;
  document.documentElement.dataset.theme =
    theme === 'dark' || (theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches)
      ? 'dark'
      : 'light';
} catch {
  /* keep the default theme */
}
