const DAY_MS = 86400000
const SINGAPORE_OFFSET_MS = 8 * 60 * 60 * 1000
export const ORDER_STATUSES = ['pending', 'accepted', 'declined', 'rescheduled', 'completed', 'cancelled']

const currency = new Intl.NumberFormat('en-SG', { style: 'currency', currency: 'SGD' })

export function formatSalesMoney(cents) {
  return currency.format(cents / 100)
}

export function singaporeDate(now = new Date()) {
  return new Date(new Date(now).getTime() + SINGAPORE_OFFSET_MS).toISOString().slice(0, 10)
}

function dateMillis(date) {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return NaN
  const millis = Date.parse(`${date}T00:00:00+08:00`)
  return Number.isFinite(millis) && singaporeDate(millis) === date ? millis : NaN
}

export function validateSalesRange(startDate, endDate) {
  const start = dateMillis(startDate)
  const end = dateMillis(endDate)
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 'Choose a valid start and end date.'
  if (start > end) return 'Start date must be on or before end date.'
  return ''
}

export function presetSalesRange(days = 30, now = new Date()) {
  if (!Number.isInteger(days) || days < 1) throw new RangeError('Days must be a positive integer.')
  const endDate = singaporeDate(now)
  return { startDate: singaporeDate(dateMillis(endDate) - (days - 1) * DAY_MS), endDate }
}

// The period of the same length just before a range, e.g. 8-14 Oct -> 1-7 Oct (for "+4.2%" changes).
export function previousSalesRange({ startDate, endDate }) {
  const start = dateMillis(startDate)
  const days = Math.round((dateMillis(endDate) - start) / DAY_MS) + 1
  return { startDate: singaporeDate(start - days * DAY_MS), endDate: singaporeDate(start - DAY_MS) }
}

// Percentage change from the previous period; null when there is nothing to compare with.
export function percentChange(current, previous) {
  if (!previous) return null
  return ((current - previous) / previous) * 100
}

// Monetary metrics use the price saved on the order, never today's product price.
function amountCents(amount) {
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0) return null
  const cents = Math.round((amount + Number.EPSILON) * 100)
  return Number.isSafeInteger(cents) ? cents : null
}

// grouping of the trend: 'daily' | 'monthly' | 'yearly'; left out = daily up to 90 days, else monthly
const KEY_LENGTH = { daily: 10, monthly: 7, yearly: 4 } // "2026-10-29" -> "2026-10-29" / "2026-10" / "2026"

export function calculateSalesAnalytics(orders, { startDate, endDate }, chosenGrouping) {
  const error = validateSalesRange(startDate, endDate)
  if (error) throw new RangeError(error)

  const start = dateMillis(startDate)
  const endExclusive = dateMillis(endDate) + DAY_MS
  const grouping = KEY_LENGTH[chosenGrouping] ? chosenGrouping : (endExclusive - start) / DAY_MS <= 90 ? 'daily' : 'monthly'
  const keyLength = KEY_LENGTH[grouping]
  const buckets = new Map()
  // Walking calendar days also handles partial months at either end of a range.
  for (let day = start; day < endExclusive; day += DAY_MS) {
    const key = singaporeDate(day).slice(0, keyLength)
    if (!buckets.has(key)) buckets.set(key, { date: key, revenueCents: 0, completedOrders: 0 })
  }

  const statusCounts = Object.fromEntries(ORDER_STATUSES.map((status) => [status, 0]))
  const products = new Map()
  let orderCount = 0
  let completedOrders = 0
  let unitsSold = 0
  let revenueCents = 0
  let pricedOrderCount = 0
  let missingAmountCount = 0

  for (const order of orders) {
    if (!order?.createdAt) continue
    const placed = new Date(order.createdAt).getTime()
    if (!Number.isFinite(placed) || placed < start || placed >= endExclusive) continue
    orderCount++
    if (Object.hasOwn(statusCounts, order.status)) statusCounts[order.status]++
    if (order.status !== 'completed') continue

    completedOrders++
    const quantity = typeof order.quantity === 'number' && Number.isFinite(order.quantity) && order.quantity > 0
      ? order.quantity : 0
    unitsSold += quantity
    const cents = amountCents(order.totalPrice)
    if (cents === null) missingAmountCount++
    else {
      revenueCents += cents
      pricedOrderCount++
    }

    const bucket = buckets.get(singaporeDate(placed).slice(0, keyLength))
    bucket.completedOrders++
    bucket.revenueCents += cents ?? 0

    const productId = String(order.product?._id || (typeof order.product === 'string' ? order.product : 'unavailable'))
    if (!products.has(productId)) {
      products.set(productId, {
        productId, name: order.product?.name || 'Unavailable product',
        units: 0, orders: 0, revenueCents: 0, pricedOrders: 0,
      })
    }
    const product = products.get(productId)
    product.units += quantity
    product.orders++
    product.revenueCents += cents ?? 0
    if (cents !== null) product.pricedOrders++
  }

  const topProducts = [...products.values()]
    .sort((a, b) => b.revenueCents - a.revenueCents || b.units - a.units || a.name.localeCompare(b.name) || a.productId.localeCompare(b.productId))
    .slice(0, 5)

  return {
    grouping, orderCount, completedOrders, unitsSold, revenueCents, pricedOrderCount, missingAmountCount,
    averageOrderValueCents: pricedOrderCount ? Math.round(revenueCents / pricedOrderCount) : 0,
    trend: [...buckets.values()], statusCounts, topProducts,
  }
}

// ---- export: one row per completed order placed in the range, as a CSV file Excel opens directly ----
const EXPORT_COLUMNS = ['Order placed', 'Product', 'Buyer', 'Quantity', 'Fulfilment', 'Pickup / delivery time', 'Total (SGD)']

// Quotes every cell; a leading = + - @ is escaped so Excel does not run it as a formula.
function csvCell(value) {
  let text = value === null || value === undefined ? '' : String(value)
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`
  return `"${text.replace(/"/g, '""')}"`
}

// "2026-10-29 14:05" in Singapore time
function singaporeDateTime(date) {
  const millis = new Date(date).getTime()
  if (!Number.isFinite(millis)) return ''
  return new Date(millis + SINGAPORE_OFFSET_MS).toISOString().slice(0, 16).replace('T', ' ')
}

export function salesCsv(orders, { startDate, endDate }) {
  const start = dateMillis(startDate)
  const endExclusive = dateMillis(endDate) + DAY_MS
  const rows = orders
    .filter((order) => {
      const placed = new Date(order?.createdAt).getTime()
      return order?.status === 'completed' && placed >= start && placed < endExclusive
    })
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
    .map((order) => {
      const cents = amountCents(order.totalPrice)
      return [
        singaporeDateTime(order.createdAt),
        order.product?.name || 'Unavailable product',
        order.buyer?.name || 'Buyer removed',
        order.quantity ?? '',
        order.fulfilment || '',
        singaporeDateTime(order.requestedTime),
        cents === null ? '' : (cents / 100).toFixed(2),
      ]
    })
  // ﻿ tells Excel the file is UTF-8 (names with accents / Chinese characters stay readable)
  return '﻿' + [EXPORT_COLUMNS, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n')
}
