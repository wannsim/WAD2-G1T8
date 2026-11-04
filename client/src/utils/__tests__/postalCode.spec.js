// TDD demo: these tests were written BEFORE utils/postalCode.js existed (red -> green -> refactor).
import { describe, it, expect } from 'vitest'
import { isValidPostalCode } from '../postalCode'

describe('TestSuite: isValidPostalCode (Singapore 6-digit postal code)', () => {
  it('Test1: accepts a 6-digit postal code', () => {
    expect(isValidPostalCode('570123')).toBe(true)
  })

  it('Test2: rejects 5 digits and 7 digits (boundaries)', () => {
    expect(isValidPostalCode('57012')).toBe(false)
    expect(isValidPostalCode('5701234')).toBe(false)
  })

  it('Test3: rejects letters and symbols', () => {
    expect(isValidPostalCode('57O123')).toBe(false) // letter O, not zero
    expect(isValidPostalCode('570-12')).toBe(false)
  })

  it('Test4: rejects empty input, null and undefined', () => {
    expect(isValidPostalCode('')).toBe(false)
    expect(isValidPostalCode(null)).toBe(false)
    expect(isValidPostalCode(undefined)).toBe(false)
  })

  it('Test5: ignores spaces before and after the code', () => {
    expect(isValidPostalCode(' 570123 ')).toBe(true)
    expect(isValidPostalCode('570 123')).toBe(false) // a space in the middle is still wrong
  })
})
