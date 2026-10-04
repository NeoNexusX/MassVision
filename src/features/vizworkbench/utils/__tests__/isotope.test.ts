import { describe, it, expect } from 'vitest'
import { isotopeEnvelope, chargeFromIonType } from '../isotope'

describe('isotopeEnvelope', () => {
  it('anchors on spacing: cholesterol C27H46O M+1 ≈ 30%, M+2 ≈ 3.7%', () => {
    const env = isotopeEnvelope('C27H46O')!
    expect(env).not.toBeNull()
    expect(env[0]).toEqual({ dm: 0, rel: 1 })
    // M+1 主要来自 27 个碳的 13C
    expect(env[1]!.rel).toBeGreaterThan(0.28)
    expect(env[1]!.rel).toBeLessThan(0.315)
    expect(env[2]!.rel).toBeGreaterThan(0.032)
    expect(env[2]!.rel).toBeLessThan(0.045)
  })

  it('places 13C spacing at ~1.00336 Da', () => {
    const env = isotopeEnvelope('C40H66O5')!
    expect(env[1]!.dm).toBeGreaterThan(1.0032)
    expect(env[1]!.dm).toBeLessThan(1.0035)
    // M+2 是双 13C 与 18O 的加权质心，略低于 2.00671
    expect(env[2]!.dm).toBeGreaterThan(2.004)
    expect(env[2]!.dm).toBeLessThan(2.0068)
  })

  it('divides spacings by charge', () => {
    const env = isotopeEnvelope('C40H66O5', 2)!
    expect(env[1]!.dm).toBeGreaterThan(0.5016)
    expect(env[1]!.dm).toBeLessThan(0.5018)
  })

  it('handles bromine 1:1 M+2 and chlorine CHCl3 ~0.96 M+2/M', () => {
    // env[1] 是 13C 的 M+1（~1-2%，在 1% 剪枝线之上），卤素峰在 M+2
    const br = isotopeEnvelope('C2H3Br')!
    expect(br[2]!.rel).toBeGreaterThan(0.9)
    expect(br[2]!.rel).toBeLessThan(1.05)
    const cl = isotopeEnvelope('CHCl3')!
    // 3 个氯：M+2/M = 3·p(37)/p(35) 近似 ≈ 0.96
    expect(cl[2]!.rel).toBeGreaterThan(0.9)
    expect(cl[2]!.rel).toBeLessThan(1.02)
  })

  it('keeps caffeine M+1 ≈ 10% with small M+2', () => {
    const env = isotopeEnvelope('C8H10N4O2')!
    expect(env[1]!.rel).toBeGreaterThan(0.095)
    expect(env[1]!.rel).toBeLessThan(0.115)
    expect(env.length <= 2 || env[2]!.rel < 0.05).toBe(true)
  })

  it('caps peaks and prunes below 1% relative intensity', () => {
    const env = isotopeEnvelope('C60H100O6')!
    expect(env.length).toBeLessThanOrEqual(5)
    for (const p of env.slice(1)) expect(p.rel).toBeGreaterThanOrEqual(0.01)
  })

  it('returns null for unparseable formulas and unknown elements', () => {
    expect(isotopeEnvelope('garbage')).toBeNull()
    expect(isotopeEnvelope('C40H66O5Xx')).toBeNull()
    expect(isotopeEnvelope('')).toBeNull()
    expect(isotopeEnvelope(null)).toBeNull()
  })

  it('is stable on repeated calls (cache path)', () => {
    const a = isotopeEnvelope('C27H46O')!
    const b = isotopeEnvelope('C27H46O')!
    expect(b).toEqual(a)
  })

  it('accepts a charge suffix on the formula itself', () => {
    const env = isotopeEnvelope('C40H66O5+')!
    expect(env).not.toBeNull()
    expect(env[1]!.dm).toBeCloseTo(1.00336, 3)
  })
})

describe('chargeFromIonType', () => {
  it('parses common adduct strings', () => {
    expect(chargeFromIonType('[M+H]+')).toBe(1)
    expect(chargeFromIonType('[M+Na]+')).toBe(1)
    expect(chargeFromIonType('M-H')).toBe(1)
    expect(chargeFromIonType('[M-2H]2-')).toBe(2)
    expect(chargeFromIonType('[M+2H]2+')).toBe(2)
    expect(chargeFromIonType('[2M+H]+')).toBe(1)
  })

  it('defaults to 1 for unknown forms', () => {
    expect(chargeFromIonType('')).toBe(1)
    expect(chargeFromIonType(null)).toBe(1)
    expect(chargeFromIonType('M')).toBe(1)
  })
})
