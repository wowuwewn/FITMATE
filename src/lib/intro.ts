export const introKey = 'fitmate.intro.seen.v1'
export function shouldShowIntro() {
  if (window.location.hash && window.location.hash !== '#home') return false
  try { return localStorage.getItem(introKey) !== 'true' } catch { return true }
}
