import { describe, it, expect } from 'vitest'
import { shopStatItems } from '../shopStats'

// shopStatItems gives [{ label, value }, ...] - this finds one value by its label
const valueOf = (items, label) => items.find((item) => item.label === label).value

describe('TestSuite: shopStatItems', () => {
  it('Test1: always gives the same 6 stats', () => {
    const items = shopStatItems({ stats: {} })
    expect(items).toHaveLength(6)
    expect(items.map((item) => item.label)).toEqual(['Ratings', 'Products', 'Response time', 'Orders fulfilled', 'Joined', 'Followers'])
  })

  it('Test2: a brand-new shop shows friendly empty values', () => {
    const items = shopStatItems({ stats: {}, createdAt: new Date() })
    expect(valueOf(items, 'Ratings')).toBe('No ratings yet')
    expect(valueOf(items, 'Response time')).toBe('New seller')
    expect(valueOf(items, 'Orders fulfilled')).toBe('-')
    expect(valueOf(items, 'Products')).toBe('-') // product count not loaded yet
    expect(valueOf(items, 'Joined')).toBe('Today')
    expect(valueOf(items, 'Followers')).toBe('0')
  })

  it('Test3: shows the rating with the number of reviews', () => {
    const items = shopStatItems({ stats: { avgRating: 4.5, reviewCount: 61 } }, 12)
    expect(valueOf(items, 'Ratings')).toBe('4.5 ★ (61)')
    expect(valueOf(items, 'Products')).toBe('12')
  })

  it('Test4: response time in minutes, then hours (1 hour vs 3 hours), then days', () => {
    expect(valueOf(shopStatItems({ stats: { avgResponseMins: 20 } }), 'Response time')).toBe('Within 20 mins')
    expect(valueOf(shopStatItems({ stats: { avgResponseMins: 60 } }), 'Response time')).toBe('Within 1 hour')
    expect(valueOf(shopStatItems({ stats: { avgResponseMins: 180 } }), 'Response time')).toBe('Within 3 hours')
    expect(valueOf(shopStatItems({ stats: { avgResponseMins: 2000 } }), 'Response time')).toBe('Within days')
  })

  it('Test5: turns the fulfilment rate into a whole percent', () => {
    expect(valueOf(shopStatItems({ stats: { fulfilmentRate: 0.876 } }), 'Orders fulfilled')).toBe('88%')
    expect(valueOf(shopStatItems({ stats: { fulfilmentRate: 1 } }), 'Orders fulfilled')).toBe('100%')
  })
})
