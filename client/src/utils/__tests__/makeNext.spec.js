// Tests for "What to make next" (makeNext.js). Written BEFORE makeNext.js (TDD).
// Every test passes its own "now", so the fixed dates below never depend on today's date.
import { describe, it, expect } from 'vitest'
import { categoryGrowth, suggestNext } from '../makeNext'

// Thursday 5 Nov 2026 in Singapore. Last 4 full weeks = Mon 5 Oct - Sun 1 Nov; the 4 before = Mon 7 Sep - Sun 4 Oct.
const NOW = new Date('2026-11-05T04:00:00Z')
const RECENT = '2026-10-20T02:00:00Z' // inside the last 4 full weeks
const BEFORE = '2026-09-15T02:00:00Z' // inside the 4 weeks before

// the seller's products and their categories (GET /forecast/make-next sends this)
const categoryOf = { p1: 'Cakes & cupcakes', p2: 'Baked goods', p3: 'Meals', p4: 'Drinks' }

// `count` orders for one product at one time
function many(productId, count, requestedTime, status = 'completed') {
  return Array.from({ length: count }, () => ({ status, requestedTime, product: { _id: productId, name: 'Product' }, totalPrice: 10 }))
}

describe('TestSuite: categoryGrowth', () => {
  it('Test1: no orders gives every category of the seller with 0 recent and 0 before', () => {
    const result = categoryGrowth([], categoryOf, NOW)
    expect(result).toHaveLength(4)
    expect(result.every((c) => c.recent === 0 && c.previous === 0 && c.growth === null)).toBe(true)
  })

  it('Test2: compares the last 4 full weeks with the 4 weeks before', () => {
    const orders = [...many('p1', 5, BEFORE), ...many('p1', 7, RECENT)]
    const cakes = categoryGrowth(orders, categoryOf, NOW).find((c) => c.category === 'Cakes & cupcakes')
    expect(cakes.previous).toBe(5)
    expect(cakes.recent).toBe(7)
    expect(cakes.growth).toBeCloseTo(0.4, 5) // +40% (toBeCloseTo is not in the Week 10 slides)
  })

  it('Test3: a category with 0 orders in the 4 weeks before does not divide by zero: growth is null and it is marked new', () => {
    const meals = categoryGrowth(many('p3', 3, RECENT), categoryOf, NOW).find((c) => c.category === 'Meals')
    expect(meals.growth).toBe(null)
    expect(meals.isNew).toBe(true)
  })

  it('Test4: counts only completed orders, and ignores this week and anything older than 8 weeks', () => {
    const orders = [
      ...many('p1', 2, RECENT),
      ...many('p1', 4, RECENT, 'cancelled'),
      ...many('p1', 3, '2026-11-03T02:00:00Z'), // this week (not finished)
      ...many('p1', 6, '2026-08-20T02:00:00Z'), // older than the 8 weeks
    ]
    const cakes = categoryGrowth(orders, categoryOf, NOW).find((c) => c.category === 'Cakes & cupcakes')
    expect(cakes.recent).toBe(2)
    expect(cakes.previous).toBe(0)
  })
})

describe('TestSuite: suggestNext', () => {
  it('Test1: no orders and no trends gives no suggestions', () => {
    expect(suggestNext([], categoryOf, [], NOW)).toEqual([])
  })

  it('Test2: score = 0.6 x own growth + 0.4 x trend, with the reason in plain words', () => {
    const orders = [...many('p1', 5, BEFORE), ...many('p1', 7, RECENT)]
    const trends = [
      { category: 'Cakes & cupcakes', term: 'chiffon', growth: 0.1 },
      { category: 'Cakes & cupcakes', term: 'pandan cake', growth: 0.35 }, // the best rising keyword is used
    ]
    const [first] = suggestNext(orders, categoryOf, trends, NOW)
    expect(first.category).toBe('Cakes & cupcakes')
    expect(first.score).toBeCloseTo(0.6 * 0.4 + 0.4 * 0.35, 5) // 0.38
    expect(first.term).toBe('pandan cake')
    expect(first.reason).toBe("Orders for Cakes & cupcakes grew 40% and 'pandan cake' is trending")
  })

  it('Test3: growth above +100% counts as the full own score (1), but the reason shows the real number', () => {
    const [first] = suggestNext([...many('p2', 2, BEFORE), ...many('p2', 6, RECENT)], categoryOf, [], NOW)
    expect(first.ownScore).toBe(1)
    expect(first.score).toBeCloseTo(0.6, 5)
    expect(first.reason).toBe('Orders for Baked goods grew 200% (from 2 to 6 orders)')
  })

  it('Test4: a category needs at least 2 recent orders to count as growing', () => {
    expect(suggestNext(many('p3', 1, RECENT), categoryOf, [], NOW)).toEqual([])
  })

  it('Test5: 0 orders before and 3 now (would divide by zero) gets the full own score and says it is new', () => {
    const [first] = suggestNext(many('p3', 3, RECENT), categoryOf, [], NOW)
    expect(first.category).toBe('Meals')
    expect(first.ownScore).toBe(1)
    expect(first.reason).toBe('Orders for Meals are new (3 in the last 4 weeks, none before)')
  })

  it('Test6: a shrinking category gets no own score, and a trend alone still gives a reason', () => {
    const orders = [...many('p1', 8, BEFORE), ...many('p1', 4, RECENT)]
    const [first] = suggestNext(orders, categoryOf, [{ category: 'Cakes & cupcakes', term: 'pandan cake', growth: 0.5 }], NOW)
    expect(first.ownScore).toBe(0)
    expect(first.score).toBeCloseTo(0.4 * 0.5, 5)
    expect(first.reason).toBe("'pandan cake' is trending (your Cakes & cupcakes orders did not grow)")
  })

  it('Test7: trends for categories the seller does not sell are ignored', () => {
    const trends = [{ category: 'Candles & home scents', term: 'soy candle', growth: 0.9 }]
    expect(suggestNext([], categoryOf, trends, NOW)).toEqual([])
  })

  it('Test8: without trend data it ranks by own growth only, gives at most 3, best first, and leaves out score 0', () => {
    const orders = [
      ...many('p1', 4, BEFORE), ...many('p1', 5, RECENT), // Cakes +25%
      ...many('p2', 2, BEFORE), ...many('p2', 3, RECENT), // Baked +50%
      ...many('p3', 2, BEFORE), ...many('p3', 4, RECENT), // Meals +100%
      ...many('p4', 4, BEFORE), ...many('p4', 4, RECENT), // Drinks 0% -> score 0
    ]
    const result = suggestNext(orders, categoryOf, [], NOW)
    expect(result.map((s) => s.category)).toEqual(['Meals', 'Baked goods', 'Cakes & cupcakes'])
    expect(result.every((s) => s.trendScore === 0)).toBe(true)
  })

  it('Test9: lists up to 3 rising keywords as ideas, best first and each once; the score still uses only the best', () => {
    const orders = [...many('p1', 5, BEFORE), ...many('p1', 7, RECENT)]
    const trends = [
      { category: 'Cakes & cupcakes', term: 'chiffon', growth: 0.1 },
      { category: 'Cakes & cupcakes', term: 'pandan cake', growth: 0.35 },
      { category: 'Cakes & cupcakes', term: 'ondeh ondeh', growth: 0.2 },
      { category: 'cakes & cupcakes', term: 'pandan cake', growth: 0.35 }, // same keyword from another shop's product
      { category: 'Cakes & cupcakes', term: 'burnt cheesecake', growth: 0.15 },
      { category: 'Cakes & cupcakes', term: 'red velvet', growth: -0.2 }, // falling: not an idea
    ]
    const [first] = suggestNext(orders, categoryOf, trends, NOW)
    expect(first.ideas.map((idea) => idea.term)).toEqual(['pandan cake', 'ondeh ondeh', 'burnt cheesecake'])
    expect(first.score).toBeCloseTo(0.6 * 0.4 + 0.4 * 0.35, 5)
    expect(first.reason).toBe("Orders for Cakes & cupcakes grew 40% and 'pandan cake' is trending")
  })

  it('Test10: categories match whatever their capitals ("baked goods" matches "Baked goods")', () => {
    const [first] = suggestNext([], categoryOf, [{ category: 'baked goods', term: 'loaf', growth: 0.5 }], NOW)
    expect(first.category).toBe('Baked goods')
    expect(first.ideas).toEqual([{ term: 'loaf', growth: 0.5 }])
    const [second] = suggestNext([], { p9: 'baked goods' }, [{ category: 'Baked goods', term: 'loaf', growth: 0.5 }], NOW)
    expect(second.category).toBe('Baked goods')
  })
})
