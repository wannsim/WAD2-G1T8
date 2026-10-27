// Unit tests for the small display helpers (no browser, no server, no database).
//   cd client && pnpm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { formatPrice, capitalize, timeAgo, shortNumber, formatDateTime } from '../src/utils/format.js'
import { cleanMrtName } from '../src/utils/googleMaps.js'

const DAY = 86400000

test('formatPrice always shows 2 decimals with a $ sign', () => {
  assert.equal(formatPrice(12), '$12.00')
  assert.equal(formatPrice(9.5), '$9.50')
  assert.equal(formatPrice(undefined), '$0.00')
})

test('capitalize only changes the first letter', () => {
  assert.equal(capitalize('within 3 hours'), 'Within 3 hours')
  assert.equal(capitalize('pending'), 'Pending')
  assert.equal(capitalize(''), '')
  assert.equal(capitalize(null), '')
})

test('timeAgo gives a short, readable age', () => {
  const now = Date.now()
  assert.equal(timeAgo(new Date(now - 2 * 3600000)), 'Today')
  assert.equal(timeAgo(new Date(now - 1 * DAY)), '1 day ago')
  assert.equal(timeAgo(new Date(now - 5 * DAY)), '5 days ago')
  assert.equal(timeAgo(new Date(now - 65 * DAY)), '2 months ago')
  assert.equal(timeAgo(new Date(now - 800 * DAY)), '2 years ago')
  assert.equal(timeAgo(null), '')
})

test('shortNumber shortens big counts', () => {
  assert.equal(shortNumber(950), '950')
  assert.equal(shortNumber(1234), '1.2k')
  assert.equal(shortNumber(25000), '25k')
})

test('formatDateTime uses Singapore time', () => {
  // 07:30 UTC = 3:30 pm in Singapore
  assert.match(formatDateTime('2026-10-21T07:30:00Z'), /21 Oct 2026.*3:30\s?pm/i)
})

test('cleanMrtName removes "MRT" / "station" so the map search finds the station', () => {
  assert.equal(cleanMrtName('Bishan MRT Station'), 'Bishan')
  assert.equal(cleanMrtName('  tampines   mrt '), 'tampines')
})
