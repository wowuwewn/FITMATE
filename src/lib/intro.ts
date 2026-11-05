export function shouldShowIntro() {
  // Run on every document load, including reloads and direct links.
  // Reduced motion changes the animation, never whether the logo is shown.
  return true
}
