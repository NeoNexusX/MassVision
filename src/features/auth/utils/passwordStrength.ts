import { t } from '@/i18n'

/**
 * Shared password-strength logic for the register, forgot-password and
 * change-password UIs. Pure functions so composables and components can
 * wrap them in `computed`. Values must stay identical across all call sites.
 */

/** 0–5 score: empty password → 0, otherwise one point per passed check. */
export function passwordScore(pw: string): number {
  if (!pw) return 0
  const checks = [
    pw.length >= 8,
    pw.length >= 12,
    /[A-Z]/.test(pw),
    /[0-9]/.test(pw),
    /[^a-zA-Z0-9]/.test(pw),
  ]
  return checks.filter(Boolean).length
}

/** Progress-bar class for a 1–5 score; any other value → 'progress-error'. */
export function passwordProgressClass(score: number): string {
  const classes = [
    'progress-error',
    'progress-warning',
    'progress-warning',
    'progress-success',
    'progress-success',
  ]
  return classes[score - 1] || 'progress-error'
}

/**
 * Strength label for a 1–5 score; any other value → the "Please Input" hint.
 * Translated on every call, so callers must keep it inside `computed` to follow language switches.
 */
export function passwordStrengthLabel(score: number): string {
  switch (score) {
    case 1:
      return t('auth.strength.veryWeak')
    case 2:
      return t('auth.strength.weak')
    case 3:
      return t('auth.strength.fair')
    case 4:
      return t('auth.strength.good')
    case 5:
      return t('auth.strength.strong')
    default:
      return t('auth.strength.empty')
  }
}
