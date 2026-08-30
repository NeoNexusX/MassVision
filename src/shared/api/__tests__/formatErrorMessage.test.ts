import { describe, expect, it } from 'vitest'
import { formatErrorMessage } from '../httpClient'

describe('formatErrorMessage', () => {
  it('returns a safe fallback for null/undefined', () => {
    expect(formatErrorMessage(null)).toBe('Unknown Error')
    expect(formatErrorMessage(undefined)).toBe('Unknown Error')
  })

  it('returns plain strings and numbers as-is', () => {
    expect(formatErrorMessage('Dataset not found')).toBe('Dataset not found')
    expect(formatErrorMessage(42)).toBe('42')
    // 空串会落到 safeStringify 后的兜底（String('') 为 falsy）
    expect(formatErrorMessage('')).toBe('Response Failed')
  })

  it('joins FastAPI validation arrays with "; "', () => {
    const detail = [
      { loc: ['body', 'name'], msg: 'Field required', type: 'missing' },
      { loc: ['body', 'size'], msg: 'Not a valid integer', type: 'int_parsing' },
    ]
    expect(formatErrorMessage(detail)).toBe('Field required; Not a valid integer')
  })

  it('falls back to a JSON dump for arrays without any message', () => {
    expect(formatErrorMessage([{ foo: 1 }])).toBe(JSON.stringify([{ foo: 1 }]))
  })

  it('unwraps nested detail recursively', () => {
    expect(formatErrorMessage({ detail: 'quota exceeded' })).toBe('quota exceeded')
    expect(formatErrorMessage({ detail: [{ msg: 'inner' }] })).toBe('inner')
    expect(formatErrorMessage({ detail: { msg: 'deep' } })).toBe('deep')
  })

  it('prefers msg/message on plain objects', () => {
    expect(formatErrorMessage({ msg: 'from msg' })).toBe('from msg')
    expect(formatErrorMessage({ message: 'from message' })).toBe('from message')
  })

  it('dumps objects without a message field', () => {
    expect(formatErrorMessage({ code: 42 })).toBe('{"code":42}')
  })

  it('survives circular references without throwing', () => {
    const circular: Record<string, unknown> = {}
    circular.self = circular
    expect(formatErrorMessage(circular)).toBe('[object Object]')
  })
})
