import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateSalesAnalytics, formatSalesMoney, presetSalesRange, singaporeDate, validateSalesRange } from '../src/utils/salesAnalytics.js'

const october = { startDate: '2026-10-01', endDate: '2026-10-31' }
function order(overrides = {}) {
  return {
    createdAt: '2026-10-10T12:00:00Z', status: 'completed', quantity: 2, totalPrice: 12.50,
    product: { _id: 'cookies', name: 'Cookies', price: 999 }, ...overrides,
  }
}

test('only completed orders contribute to sales; every status contributes to status counts', () => {
  const statuses = ['completed', 'pending', 'accepted', 'declined', 'rescheduled', 'cancelled']
  const result = calculateSalesAnalytics(statuses.map((status) => order({ status })), october)
  assert.equal(result.orderCount, 6)
  assert.equal(result.completedOrders, 1)
  assert.equal(result.unitsSold, 2)
  assert.equal(result.revenueCents, 1250)
  assert.equal(result.averageOrderValueCents, 1250)
  assert.deepEqual(Object.values(result.statusCounts), [1, 1, 1, 1, 1, 1])
})

test('uses saved order totals without multiplying by quantity or current product prices', () => {
  const result = calculateSalesAnalytics([order(), order({ quantity: 3, totalPrice: 20 })], october)
  assert.equal(result.revenueCents, 3250)
  assert.equal(result.unitsSold, 5)
  assert.equal(result.averageOrderValueCents, 1625)
  assert.deepEqual(result.topProducts[0], {
    productId: 'cookies', name: 'Cookies', units: 5, orders: 2, revenueCents: 3250, pricedOrders: 2,
  })
})

test('calculates money in cents and rounds average value to cents', () => {
  const result = calculateSalesAnalytics([order({ totalPrice: 0.1 }), order({ totalPrice: 0.2 }), order({ totalPrice: 0.01 })], october)
  assert.equal(result.revenueCents, 31)
  assert.equal(result.averageOrderValueCents, 10)
  assert.equal(calculateSalesAnalytics([order({ totalPrice: 1.005 })], october).revenueCents, 101)
  assert.match(formatSalesMoney(123456), /1,234\.56/)
})

test('Singapore date boundaries include the full end day and exclude the next midnight', () => {
  const result = calculateSalesAnalytics([
    order({ createdAt: '2026-09-30T15:59:59.999Z' }),
    order({ createdAt: '2026-09-30T16:00:00.000Z' }),
    order({ createdAt: '2026-10-31T15:59:59.999Z' }),
    order({ createdAt: '2026-10-31T16:00:00.000Z' }),
  ], october)
  assert.equal(result.completedOrders, 2)
  assert.equal(result.trend[0].completedOrders, 1)
  assert.equal(result.trend.at(-1).completedOrders, 1)
  assert.equal(result.trend.at(-1).date, '2026-10-31')
})

test('buckets use order placement, not requested, updated, or completion dates', () => {
  const result = calculateSalesAnalytics([order({
    createdAt: '2026-10-01T16:30:00Z', requestedTime: '2026-11-01T00:00:00Z',
    updatedAt: '2026-11-02T00:00:00Z', completedAt: '2026-11-02T00:00:00Z',
  })], october)
  assert.equal(result.trend[1].date, '2026-10-02')
  assert.equal(result.trend[1].revenueCents, 1250)
  assert.equal(result.trend[0].revenueCents, 0)
})

test('empty periods contain zero totals and every daily bucket', () => {
  const result = calculateSalesAnalytics([], october)
  assert.equal(result.orderCount, 0)
  assert.equal(result.completedOrders, 0)
  assert.equal(result.revenueCents, 0)
  assert.equal(result.unitsSold, 0)
  assert.equal(result.averageOrderValueCents, 0)
  assert.equal(result.trend.length, 31)
  assert.ok(result.trend.every((point) => point.revenueCents === 0 && point.completedOrders === 0))
  assert.deepEqual(result.topProducts, [])
  assert.ok(Object.values(result.statusCounts).every((count) => count === 0))
})

test('orders with no completed sales still populate status counts', () => {
  const result = calculateSalesAnalytics([order({ status: 'pending' }), order({ status: 'accepted' })], october)
  assert.equal(result.orderCount, 2)
  assert.equal(result.completedOrders, 0)
  assert.equal(result.statusCounts.pending, 1)
  assert.equal(result.statusCounts.accepted, 1)
  assert.equal(result.averageOrderValueCents, 0)
})

test('missing product references retain historical sales', () => {
  const result = calculateSalesAnalytics([order({ product: null }), order({ product: undefined })], october)
  assert.equal(result.revenueCents, 2500)
  assert.equal(result.topProducts[0].name, 'Unavailable product')
  assert.equal(result.topProducts[0].orders, 2)
})

test('invalid monetary amounts are excluded from revenue and the average denominator', () => {
  const invalid = [undefined, null, '', '12', NaN, Infinity, -1, Number.MAX_VALUE]
  const result = calculateSalesAnalytics([
    ...invalid.map((totalPrice) => order({ totalPrice })), order({ totalPrice: 20 }), order({ totalPrice: 0 }),
  ], october)
  assert.equal(result.completedOrders, 10)
  assert.equal(result.unitsSold, 20)
  assert.equal(result.missingAmountCount, 8)
  assert.equal(result.pricedOrderCount, 2)
  assert.equal(result.revenueCents, 2000)
  assert.equal(result.averageOrderValueCents, 1000)
  assert.equal(result.trend[9].revenueCents, 2000)
})

test('all invalid amounts and invalid quantities never produce non-finite metrics', () => {
  const result = calculateSalesAnalytics([
    order({ totalPrice: null, quantity: Infinity }), order({ totalPrice: -1, quantity: -5 }),
    order({ totalPrice: NaN, quantity: undefined }),
  ], october)
  assert.equal(result.revenueCents, 0)
  assert.equal(result.averageOrderValueCents, 0)
  assert.equal(result.unitsSold, 0)
  assert.equal(result.missingAmountCount, 3)
  assert.equal(result.topProducts[0].pricedOrders, 0)
})

test('top products rank by revenue, units, then name and return only five', () => {
  const fixtures = [
    ['z', 'Zebra', 50, 1], ['b', 'Banana', 20, 3], ['a', 'Apple', 20, 3],
    ['m', 'Mango', 20, 2], ['p', 'Pear', 10, 9], ['o', 'Orange', 5, 10],
  ].map(([id, name, totalPrice, quantity]) => order({ product: { _id: id, name }, totalPrice, quantity }))
  const result = calculateSalesAnalytics(fixtures, october)
  assert.deepEqual(result.topProducts.map((product) => product.name), ['Zebra', 'Apple', 'Banana', 'Mango', 'Pear'])
})

test('daily grouping includes 90 days; longer ranges use months including partial months', () => {
  assert.equal(calculateSalesAnalytics([], { startDate: '2026-01-01', endDate: '2026-03-31' }).grouping, 'daily')
  const result = calculateSalesAnalytics([
    order({ createdAt: '2025-12-30T16:00:00Z' }),
    order({ createdAt: '2026-03-31T15:59:59Z', totalPrice: 10 }),
  ], { startDate: '2025-12-31', endDate: '2026-03-31' })
  assert.equal(result.grouping, 'monthly')
  assert.deepEqual(result.trend.map((point) => point.date), ['2025-12', '2026-01', '2026-02', '2026-03'])
  assert.deepEqual(result.trend.map((point) => point.revenueCents), [1250, 0, 0, 1000])
})

test('presets include today in Singapore, even when the UTC date is yesterday', () => {
  const now = new Date('2025-12-31T16:30:00Z')
  assert.equal(singaporeDate(now), '2026-01-01')
  assert.deepEqual(presetSalesRange(7, now), { startDate: '2025-12-26', endDate: '2026-01-01' })
  assert.deepEqual(presetSalesRange(30, now), { startDate: '2025-12-03', endDate: '2026-01-01' })
  assert.deepEqual(presetSalesRange(90, now), { startDate: '2025-10-04', endDate: '2026-01-01' })
  assert.throws(() => presetSalesRange(0, now), RangeError)
})

test('leap-day ranges and presets cross month boundaries correctly', () => {
  assert.deepEqual(presetSalesRange(7, new Date('2024-03-01T00:00:00+08:00')), { startDate: '2024-02-24', endDate: '2024-03-01' })
  const result = calculateSalesAnalytics([], { startDate: '2024-02-28', endDate: '2024-03-01' })
  assert.deepEqual(result.trend.map((point) => point.date), ['2024-02-28', '2024-02-29', '2024-03-01'])
})

test('rejects missing, malformed, impossible, and reversed dates; permits a single day', () => {
  for (const date of ['', undefined, '2026-02-30', '2026-13-01', '2026-2-01', '2026-01-00']) {
    assert.notEqual(validateSalesRange(date, '2026-10-01'), '')
    assert.throws(() => calculateSalesAnalytics([], { startDate: date, endDate: '2026-10-01' }), RangeError)
  }
  assert.match(validateSalesRange('2026-10-02', '2026-10-01'), /on or before/)
  assert.equal(validateSalesRange('2026-10-01', '2026-10-01'), '')
  assert.equal(calculateSalesAnalytics([], { startDate: '2026-10-01', endDate: '2026-10-01' }).trend.length, 1)
})

test('ignores absent or invalid placement dates and leaves the input unchanged', () => {
  const fixtures = [order(), order({ createdAt: 'invalid' }), order({ createdAt: null }), null]
  const before = structuredClone(fixtures)
  const result = calculateSalesAnalytics(fixtures, october)
  assert.equal(result.orderCount, 1)
  assert.deepEqual(fixtures, before)
})
