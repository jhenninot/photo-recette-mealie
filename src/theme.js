// Préférence d'apparence : « auto » suit le mode nuit de l'appareil (via prefers-color-scheme en CSS),
// « light » et « dark » forcent le thème. Mémorisée sur l'appareil pour s'appliquer dès le chargement
// (voir le script dans index.html), et sur le compte pour suivre l'utilisateur sur ses autres appareils.
const THEME_KEY = 'photo-recette-theme'
export const THEMES = ['auto', 'light', 'dark']

export function applyTheme(theme) {
  const value = THEMES.includes(theme) ? theme : 'auto'
  if (value === 'auto') document.documentElement.removeAttribute('data-theme')
  else document.documentElement.setAttribute('data-theme', value)
  try { localStorage.setItem(THEME_KEY, value) } catch { /* stockage indisponible */ }
  return value
}
