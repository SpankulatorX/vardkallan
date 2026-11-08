// Högkontrastläget (Sussa 8.4.1.3, K2 1.4.3). Systemet följer datorns inställning för hög kontrast, och knappen Hög
// kontrast väljer läget själv. Valet sparas i webbläsaren och gäller alla sidor. Läget sätts på html-elementet som
// data-kontrast="hog" eller "normal", och app.css har färgerna för båda.
const NYCKEL = 'vk-kontrast';
const datorn = () => Boolean(window.matchMedia?.('(prefers-contrast: more)').matches || window.matchMedia?.('(forced-colors: active)').matches);
const sparat = () => { try { return localStorage.getItem(NYCKEL); } catch { return null; } };

// true när högkontrastläget gäller.
export const kontrastLage = () => (sparat() ? sparat() === 'hog' : datorn());

export function tillampa() {
  const hog = kontrastLage();
  document.documentElement.dataset.kontrast = hog ? 'hog' : 'normal';
  for (const b of document.querySelectorAll('[data-a="kontrast"]')) b.setAttribute('aria-pressed', String(hog));
}

export function vaxla() {
  const hog = !kontrastLage();
  // Samma val som datorns inställning sparas inte, så att en ändring i datorn gäller igen.
  try { if (hog === datorn()) localStorage.removeItem(NYCKEL); else localStorage.setItem(NYCKEL, hog ? 'hog' : 'normal'); } catch { /* ingen lagring */ }
  tillampa();
}

export function init() {
  tillampa();
  window.matchMedia?.('(prefers-contrast: more)').addEventListener?.('change', tillampa);
}
