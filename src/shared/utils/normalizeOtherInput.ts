/**
 * Normalization and validation for "Other" custom text inputs in select dropdowns.
 *
 * Rules:
 * - Trim leading/trailing whitespace
 * - Collapse consecutive spaces
 * - Convert to Title Case
 * - Max 50 characters
 * - Allow only: A-Z a-z 0-9 space - _ / ( ) , .
 */

const MAX_LENGTH = 50
const ALLOWED_RE = /^[A-Za-z0-9\s\-_/(),.]*$/

export function normalizeOtherInput(raw: string): string {
  return raw
    .trim()
    .replace(/\s+/g, ' ')
}

export function toTitleCase(text: string): string {
  return text
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

export function validateOtherInput(value: string): string {
  const normalized = normalizeOtherInput(value)

  if (!normalized) {
    return ''
  }

  if (normalized.length > MAX_LENGTH) {
    return `Please keep the value under ${MAX_LENGTH} characters.`
  }

  if (!ALLOWED_RE.test(normalized)) {
    return 'Only letters, numbers, spaces, hyphens, underscores, slashes, parentheses, commas, and periods are allowed.'
  }

  return ''
}
