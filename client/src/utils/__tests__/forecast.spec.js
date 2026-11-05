// Tests for the "Forecast and what to make next" maths (forecast.js). Written BEFORE forecast.js (TDD).
// Every test passes its own "now", so the fixed dates below never depend on today's date.
import { describe, it, expect } from 'vitest'
import { weeklyTotals, forecastWeeks, busiestSlots, backtest, rollingBacktest } from '../forecast'

// Thursday 5 Nov 2026, 12:00 in Singapore -> this week starts Mon 2 Nov, the last FULL week is Mon 26 Oct
const NOW = new Date('2026-11-05T04:00:00Z')

const completed = (requestedTime, totalPrice = 10) => ({ status: 'completed', requestedTime, totalPrice, createdAt: requestedTime })

// weekly totals for a list of counts, one week apart, starting Mon 21 Sep 2026
function series(counts) {
  return counts.map((orders, i) => ({
    week: new Date(Date.UTC(2026, 8, 21 + i * 7)).toISOString().slice(0, 10),
    orders,
    revenueCents: orders * 1000,
  }))
}

describe('TestSuite: weeklyTotals', () => {
  it('Test1: no orders gives an empty list', () => {
    expect(weeklyTotals([], NOW)).toEqual([])
  })

  it('Test2: groups completed orders into Monday-Sunday weeks with the count and the revenue', () => {
    const orders = [
      completed('2026-10-20T02:00:00Z', 12.5), // Tue 20 Oct
      completed('2026-10-24T06:00:00Z', 7.5), // Sat 24 Oct
      completed('2026-10-27T02:00:00Z', 20), // Tue 27 Oct
    ]
    expect(weeklyTotals(orders, NOW)).toEqual([
      { week: '2026-10-19', orders: 2, revenueCents: 2000 },
      { week: '2026-10-26', orders: 1, revenueCents: 2000 },
    ])
  })

  it('Test3: a week with no orders is still there, with 0', () => {
    const orders = [completed('2026-10-06T02:00:00Z'), completed('2026-10-27T02:00:00Z')]
    expect(weeklyTotals(orders, NOW)).toEqual([
      { week: '2026-10-05', orders: 1, revenueCents: 1000 },
      { week: '2026-10-12', orders: 0, revenueCents: 0 },
      { week: '2026-10-19', orders: 0, revenueCents: 0 },
      { week: '2026-10-26', orders: 1, revenueCents: 1000 },
    ])
  })

  it('Test4: pending, accepted, declined and cancelled orders are ignored', () => {
    const time = '2026-10-27T02:00:00Z'
    const orders = [
      completed(time),
      { status: 'pending', requestedTime: time, totalPrice: 10 },
      { status: 'accepted', requestedTime: time, totalPrice: 10 },
      { status: 'declined', requestedTime: time, totalPrice: 10 },
      { status: 'cancelled', requestedTime: time, totalPrice: 10 },
    ]
    expect(weeklyTotals(orders, NOW)).toEqual([{ week: '2026-10-26', orders: 1, revenueCents: 1000 }])
  })

  it('Test5: Sunday 17:30 UTC is already Monday 01:30 in Singapore, so it counts in the NEXT week', () => {
    const orders = [completed('2026-10-25T17:30:00Z')] // Sun 25 Oct in UTC, Mon 26 Oct in Singapore
    expect(weeklyTotals(orders, NOW)).toEqual([{ week: '2026-10-26', orders: 1, revenueCents: 1000 }])
  })

  it('Test6: uses the pickup/delivery time, and the order date only when there is no pickup time', () => {
    const orders = [
      { status: 'completed', createdAt: '2026-10-14T02:00:00Z', requestedTime: '2026-10-27T02:00:00Z', totalPrice: 10 },
      { status: 'completed', createdAt: '2026-10-28T02:00:00Z', totalPrice: 10 }, // no requestedTime
    ]
    expect(weeklyTotals(orders, NOW)).toEqual([{ week: '2026-10-26', orders: 2, revenueCents: 2000 }])
  })

  it('Test7: this week is not finished yet, so it is left out', () => {
    const orders = [completed('2026-10-27T02:00:00Z'), completed('2026-11-03T02:00:00Z')] // Tue 3 Nov = this week
    expect(weeklyTotals(orders, NOW)).toEqual([{ week: '2026-10-26', orders: 1, revenueCents: 1000 }])
    expect(weeklyTotals([completed('2026-11-03T02:00:00Z')], NOW)).toEqual([])
  })
})

describe('TestSuite: forecastWeeks', () => {
  it('Test1: no history gives no forecast', () => {
    expect(forecastWeeks([])).toEqual([])
  })

  it('Test2: fewer than 4 weeks gives no forecast, even with many orders', () => {
    expect(forecastWeeks(series([10, 12, 11]))).toEqual([])
  })

  it('Test3: fewer than 10 completed orders gives no forecast', () => {
    expect(forecastWeeks(series([1, 2, 1, 2, 1, 2]))).toEqual([]) // 9 orders
  })

  it('Test4: the worked example (4, 6, 5, 7, 8, 9) gives about 9.8 (9.1-10.5) for week 7 and 10.7 (9.7-11.7) for week 8', () => {
    const result = forecastWeeks(series([4, 6, 5, 7, 8, 9]))
    expect(result).toHaveLength(4)
    expect(result.map((w) => w.week)).toEqual(['2026-11-02', '2026-11-09', '2026-11-16', '2026-11-23'])

    // toBeCloseTo(value, 1) = equal to 1 decimal place (not in the Week 10 slides)
    expect(result[0].expected).toBeCloseTo(9.8, 1)
    expect(result[0].low).toBeCloseTo(9.1, 1)
    expect(result[0].high).toBeCloseTo(10.5, 1)
    expect(result[1].expected).toBeCloseTo(10.7, 1)
    expect(result[1].low).toBeCloseTo(9.7, 1)
    expect(result[1].high).toBeCloseTo(11.7, 1)
  })

  it('Test5: a flat series (5 every week) forecasts 5 every week, with no spread', () => {
    const result = forecastWeeks(series([5, 5, 5, 5, 5, 5]))
    expect(result.map((w) => w.expected)).toEqual([5, 5, 5, 5])
    expect(result.map((w) => w.low)).toEqual([5, 5, 5, 5])
    expect(result.map((w) => w.high)).toEqual([5, 5, 5, 5])
  })

  it('Test6: a rising series keeps rising, and the range gets wider further ahead', () => {
    const result = forecastWeeks(series([3, 5, 4, 7, 8, 10]))
    expect(result[0].expected > 10).toBe(true)
    expect(result[1].expected > result[0].expected).toBe(true)
    expect(result[3].expected > result[2].expected).toBe(true)
    expect(result[3].high - result[3].low > result[0].high - result[0].low).toBe(true)
  })

  it('Test7: a week with no orders still gives a forecast, with a wider range than a steady series', () => {
    const result = forecastWeeks(series([5, 5, 0, 5, 5, 5]))
    expect(result).toHaveLength(4)
    expect(result[0].high - result[0].low > 0).toBe(true)
  })

  it('Test8: a falling series never forecasts fewer than 0 orders', () => {
    const result = forecastWeeks(series([12, 9, 6, 3, 1, 0]))
    expect(result.every((w) => w.expected >= 0 && w.low >= 0)).toBe(true)
  })
})

describe('TestSuite: busiestSlots', () => {
  // 10 completed orders: 4 on Saturdays, 3 on Sundays, 2 on Wednesdays, 1 on a Monday
  const orders = [
    completed('2026-10-10T02:00:00Z'), completed('2026-10-17T02:00:00Z'), completed('2026-10-24T02:00:00Z'), completed('2026-10-31T02:00:00Z'), // Sat
    completed('2026-10-11T02:00:00Z'), completed('2026-10-18T02:00:00Z'), completed('2026-10-25T02:00:00Z'), // Sun
    completed('2026-10-14T02:00:00Z'), completed('2026-10-21T02:00:00Z'), // Wed
    completed('2026-10-12T02:00:00Z'), // Mon
  ]

  it('Test1: no orders gives 0 for every day and no suggestion', () => {
    const result = busiestSlots([])
    expect(result.days).toHaveLength(7)
    expect(result.days.every((d) => d.orders === 0)).toBe(true)
    expect(result.top).toEqual([])
    expect(result.suggestion).toBe('')
  })

  it('Test2: counts orders per weekday (Monday first) and picks the 2 busiest', () => {
    const result = busiestSlots(orders)
    expect(result.days.map((d) => d.orders)).toEqual([1, 0, 2, 0, 0, 4, 3])
    expect(result.top).toEqual(['Saturday', 'Sunday'])
  })

  it('Test3: gives a plain-language suggestion', () => {
    expect(busiestSlots(orders).suggestion).toBe('Add more slot capacity on Saturdays and Sundays (70% of your completed orders).')
  })

  it('Test4: Saturday 17:30 UTC is Sunday 01:30 in Singapore, so it counts as Sunday', () => {
    const result = busiestSlots([completed('2026-10-10T17:30:00Z')])
    expect(result.days[6]).toEqual({ day: 'Sunday', orders: 1, revenueCents: 1000 })
    expect(result.days[5].orders).toBe(0)
  })

  it('Test5: cancelled orders are ignored, and under 10 orders there is no suggestion yet', () => {
    const result = busiestSlots([...orders.slice(0, 9), { status: 'cancelled', requestedTime: '2026-10-12T02:00:00Z' }])
    expect(result.days[0].orders).toBe(0) // the only Monday order was cut, and the cancelled one does not count
    expect(result.suggestion).toBe('')
  })

  it('Test6: orders spread evenly (top 2 days under 40%) -> says so instead of picking days', () => {
    // 14 orders, 2 on every weekday (Mon 12 Oct - Sun 25 Oct): the top 2 days have 4 of 14 = 29%
    const even = []
    for (let day = 12; day <= 18; day++) even.push(completed(`2026-10-${day}T02:00:00Z`), completed(`2026-10-${day + 7}T02:00:00Z`))
    const result = busiestSlots(even)
    expect(result.suggestion).toBe('Your orders are spread fairly evenly across the week.')
    expect(result.top).toEqual([])
  })

  it('Test7: exactly 40% on the top 2 days is concentrated enough for a suggestion', () => {
    // 10 orders: Fri 2, Sat 2, Mon 2 (cheaper, so Monday loses the tie), Tue, Wed, Thu, Sun 1 each -> 4 of 10 = 40%
    const concentrated = [
      completed('2026-10-16T02:00:00Z', 20), completed('2026-10-23T02:00:00Z', 20), // Fri
      completed('2026-10-17T02:00:00Z', 20), completed('2026-10-24T02:00:00Z', 20), // Sat
      completed('2026-10-12T02:00:00Z'), completed('2026-10-19T02:00:00Z'), // Mon
      completed('2026-10-13T02:00:00Z'), completed('2026-10-14T02:00:00Z'), completed('2026-10-15T02:00:00Z'), completed('2026-10-18T02:00:00Z'),
    ]
    const result = busiestSlots(concentrated)
    expect(result.top).toEqual(['Friday', 'Saturday'])
    expect(result.suggestion).toBe('Add more slot capacity on Fridays and Saturdays (40% of your completed orders).')
  })
})

describe('TestSuite: backtest', () => {
  it('Test1: needs at least 8 weeks (4 to learn from + 4 to check), otherwise gives null', () => {
    expect(backtest(series([4, 6, 5, 7, 8, 9, 10]))).toBe(null)
  })

  it('Test2: hides the last 4 weeks and returns the forecast, the naive guess and the real value for each', () => {
    const result = backtest(series([2, 4, 6, 8, 10, 12, 14, 16]))
    expect(result.weeks).toHaveLength(4)
    expect(result.weeks.map((w) => w.actual)).toEqual([10, 12, 14, 16])
    expect(result.weeks.map((w) => w.naive)).toEqual([8, 8, 8, 8]) // "same as last week" = the last week it could see
  })

  it('Test3: on a steadily rising series, my method beats "same as last week"', () => {
    const result = backtest(series([2, 4, 6, 8, 10, 12, 14, 16]))
    expect(result.methodError).toBeCloseTo(0, 5)
    expect(result.naiveError).toBe(5) // misses by 2, 4, 6, 8 -> average 5
  })

  it('Test4: on a flat series both methods are perfect', () => {
    const result = backtest(series([5, 5, 5, 5, 5, 5, 5, 5]))
    expect(result.methodError).toBe(0)
    expect(result.naiveError).toBe(0)
  })
})

describe('TestSuite: rollingBacktest', () => {
  it('Test1: needs at least 8 weeks (4 to learn from + 4 to check), otherwise gives null', () => {
    expect(rollingBacktest(series([4, 6, 5, 7, 8, 9, 10]))).toBe(null)
  })

  it('Test2: uses every cut-off with at least 4 weeks before it and 4 weeks after it', () => {
    // 10 weeks -> cut-offs after week 4, 5 and 6
    expect(rollingBacktest(series([2, 4, 6, 8, 10, 12, 14, 16, 18, 20])).cutoffs).toBe(3)
  })

  it('Test3: on a steadily rising series, my method beats "same as last week" from every cut-off', () => {
    const result = rollingBacktest(series([2, 4, 6, 8, 10, 12, 14, 16, 18, 20]))
    expect(result.methodError).toBeCloseTo(0, 5)
    expect(result.naiveError).toBe(5) // from every cut-off the naive guess misses by 2, 4, 6, 8
  })

  it('Test4: on a flat series both methods are perfect', () => {
    const result = rollingBacktest(series([5, 5, 5, 5, 5, 5, 5, 5, 5]))
    expect(result.cutoffs).toBe(2)
    expect(result.methodError).toBe(0)
    expect(result.naiveError).toBe(0)
  })

  it('Test5: skips cut-offs with fewer than 10 orders before them, and gives null if none are left', () => {
    // before week 5: 4 orders, before week 6: 7, before week 7: 10 -> only the last cut-off is used
    expect(rollingBacktest(series([1, 1, 1, 1, 3, 3, 3, 3, 3, 3])).cutoffs).toBe(1)
    expect(rollingBacktest(series([1, 1, 1, 1, 1, 1, 1, 1]))).toBe(null)
  })
})
