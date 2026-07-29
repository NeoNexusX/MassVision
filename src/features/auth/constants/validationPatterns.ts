/**
 * Validation patterns shared by auth-related forms (register, forgot
 * password, profile). Kept as plain strings so callers can pass them to
 * <input pattern> or wrap them with `new RegExp(...)`.
 */
export const VALIDATION_PATTERNS = {
  email: '^[A-Za-z0-9._%+\\-]+@[A-Za-z0-9.\\-]+\\.[A-Za-z]{2,}$',
  password: '^(?=.*[a-zA-Z])(?=.*\\d).{8,25}$',
  verify_code: '^[0-9]{6}$',
} as const

/**
 * Profile-page email check — intentionally looser than
 * VALIDATION_PATTERNS.email. Do NOT unify the two; each call site keeps its
 * historical regex.
 */
export const PROFILE_EMAIL_PATTERN = '^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$'
