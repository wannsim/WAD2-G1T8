import { describe, it, expect } from 'vitest'
import { validateSalesRange, percentChange, previousSalesRange } from '../salesAnalytics'

describe('TestSuite: validateSalesRange', () => {
  it('Test1: a normal range, and a one-day range, are OK (no message)', () => {
    expect(validateSalesRange('2026-10-01', '2026-10-31')).toBe('')
    expect(validateSalesRange('2026-10-15', '2026-10-15')).toBe('')
  })

  it('Test2: a start date after the end date gives an error', () => {
    expect(validateSalesRange('2026-10-31', '2026-10-01')).toBe('Start date must be on or before end date.')
  })

  it('Test3: impossible or empty dates give an error', () => {
    expect(validateSalesRange('2026-02-30', '2026-03-01')).toBe('Choose a valid start and end date.')
    expect(validateSalesRange('', '2026-03-01')).toBe('Choose a valid start and end date.')
  })
})

describe('TestSuite: percentChange', () => {
  it('Test1: works out the change from the previous period', () => {
    expect(percentChange(150, 100)).toBe(50)
    expect(percentChange(50, 100)).toBe(-50)
  })

  it('Test2: nothing to compare with (previous = 0) gives null', () => {
    expect(percentChange(5, 0)).toBe(null)
  })
})

describe('TestSuite: previousSalesRange', () => {
  it('Test1: gives the period of the same length just before', () => {
    expect(previousSalesRange({ startDate: '2026-10-08', endDate: '2026-10-14' }))
      .toEqual({ startDate: '2026-10-01', endDate: '2026-10-07' })
  })
})
