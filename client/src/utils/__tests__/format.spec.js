import { describe, it, expect } from 'vitest'
import { formatPrice, formatDateTime, capitalize, timeAgo } from '../format'

const HOUR = 3600000
const DAY = 24 * HOUR

// a date TODAY (whatever day the test runs) at the given UTC time - never a hard-coded date
function todayAtUtc(hours, minutes) {
  const d = new Date()
  d.setUTCHours(hours, minutes, 0, 0)
  return d
}
// the browser may put a special narrow space before "am" / "pm" - turn every space into a normal one
const plain = (text) => text.replace(/\s/g, ' ')

describe('TestSuite: formatPrice', () => {
  it('Test1: always shows a $ sign and 2 decimal places', () => {
    expect(formatPrice(12)).toBe('$12.00')
    expect(formatPrice(9.5)).toBe('$9.50')
    expect(formatPrice('6.5')).toBe('$6.50')
  })

  it('Test2: shows $0.00 for zero and for a missing price', () => {
    expect(formatPrice(0)).toBe('$0.00')
    expect(formatPrice(undefined)).toBe('$0.00')
    expect(formatPrice(null)).toBe('$0.00')
  })
})

describe('TestSuite: formatDateTime (Singapore time)', () => {
  it('Test1: 07:30 UTC is shown as 3:30 pm on the same day in Singapore', () => {
    const date = todayAtUtc(7, 30)
    const text = plain(formatDateTime(date))
    expect(text).toContain('3:30 pm')
    expect(text.split(' ')[0]).toBe(String(date.getUTCDate()))
    expect(text).toContain(String(date.getUTCFullYear()))
  })

  it('Test2: 17:30 UTC crosses midnight - it is 1:30 am the NEXT day in Singapore', () => {
    const date = todayAtUtc(17, 30)
    const nextDay = new Date(date.getTime() + DAY)
    const text = plain(formatDateTime(date))
    expect(text).toContain('1:30 am')
    expect(text.split(' ')[0]).toBe(String(nextDay.getUTCDate()))
    expect(text.split(' ')[0]).not.toBe(String(date.getUTCDate()))
  })

  it('Test3: gives an empty string when there is no date', () => {
    expect(formatDateTime('')).toBe('')
    expect(formatDateTime(null)).toBe('')
  })
})

describe('TestSuite: capitalize', () => {
  it('Test1: only the first letter becomes a capital', () => {
    expect(capitalize('pending')).toBe('Pending')
    expect(capitalize('within 3 hours')).toBe('Within 3 hours')
  })

  it('Test2: empty text and null give an empty string', () => {
    expect(capitalize('')).toBe('')
    expect(capitalize(null)).toBe('')
  })
})

describe('TestSuite: timeAgo', () => {
  it('Test1: anything less than a day old is "Today"', () => {
    expect(timeAgo(new Date(Date.now() - 2 * HOUR))).toBe('Today')
    expect(timeAgo(new Date())).toBe('Today')
  })

  it('Test2: uses "day" for 1 and "days" for more', () => {
    expect(timeAgo(new Date(Date.now() - 1 * DAY))).toBe('1 day ago')
    expect(timeAgo(new Date(Date.now() - 5 * DAY))).toBe('5 days ago')
  })

  it('Test3: switches to months at 30 days and to years at 365 days (boundaries)', () => {
    expect(timeAgo(new Date(Date.now() - 29 * DAY))).toBe('29 days ago')
    expect(timeAgo(new Date(Date.now() - 30 * DAY))).toBe('1 month ago')
    expect(timeAgo(new Date(Date.now() - 364 * DAY))).toBe('12 months ago')
    expect(timeAgo(new Date(Date.now() - 365 * DAY))).toBe('1 year ago')
  })

  it('Test4: gives an empty string when there is no date', () => {
    expect(timeAgo(null)).toBe('')
    expect(timeAgo(undefined)).toBe('')
  })
})
