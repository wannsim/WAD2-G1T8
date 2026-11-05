// Owner: Wan Sim
// What to make next (seller Analytics page). Home sellers don't know what to make next, so they guess.
// This ranks the seller's own categories by two signals and explains each suggestion in plain words:
//   (1) own growth: completed orders in the last 4 full weeks compared with the 4 weeks before
//   (2) trend: the best rising YouTube keyword (utils/trends.js on the server) in that category
//   score = 0.6 x own score + 0.4 x trend score        (each score is 0 to 1)
// Formulas and a worked example: ALGORITHMS.md. Tests: __tests__/makeNext.spec.js (written first).
import { weeklyTotals } from './forecast'
import { toCategory } from './constants'

// Own orders count more than the trend: they are real buyers of THIS shop, while a YouTube trend is general
// interest in Singapore. With 60 / 40, a trend can lift a slowly growing category above a flat one, but a
// trend alone (at most 0.4) can never beat a category whose own orders doubled (0.6).
export const OWN_WEIGHT = 0.6
export const TREND_WEIGHT = 0.4
// +100% or more counts as the full score, so one huge jump (2 -> 20 orders) can't drown out everything else
export const GROWTH_CAP = 1
// going from 1 order to 2 is "+100%" but says nothing yet: a category needs 2 recent orders to count as growing
export const MIN_RECENT_ORDERS = 2
export const PERIOD_WEEKS = 4
export const MAX_SUGGESTIONS = 3
export const MAX_IDEAS = 3 // rising keywords shown under each suggestion ("Ideas to explore")

const clamp = (value) => Math.min(Math.max(value, 0), GROWTH_CAP) / GROWTH_CAP
const sum = (weeks) => weeks.reduce((total, w) => total + w.orders, 0)
const productId = (order) => String(order?.product?._id ?? order?.product ?? '')

// For each of the seller's categories: { category, recent, previous, growth, isNew }
//   recent   = completed orders in the last 4 full weeks, previous = in the 4 weeks before (Singapore weeks,
//   by pickup/delivery date - the same weeks as the forecast, because it uses weeklyTotals)
//   growth   = (recent - previous) / previous, e.g. 5 -> 7 = 0.4 (+40%)
//            = null when previous is 0: you can't divide by 0, so the category is marked isNew instead
export function categoryGrowth(orders, categoryOf = {}, now = new Date()) {
  // an order's category, or null when its product is not (or no longer) in this shop
  const categoryOfOrder = (order) => (productId(order) in categoryOf ? toCategory(categoryOf[productId(order)]) : null)
  const categories = [...new Set(Object.values(categoryOf).map(toCategory))]
  return categories.map((category) => {
    const own = (orders || []).filter((order) => categoryOfOrder(order) === category)
    const weekly = weeklyTotals(own, now)
    const recent = sum(weekly.slice(-PERIOD_WEEKS))
    const previous = sum(weekly.slice(-2 * PERIOD_WEEKS, -PERIOD_WEEKS))
    return {
      category,
      recent,
      previous,
      growth: previous > 0 ? (recent - previous) / previous : null,
      isNew: previous === 0 && recent > 0,
    }
  })
}

// own score (0 to 1): 0 under 2 recent orders or when orders did not grow; a new category (0 before) counts
// as the full score, like +100%; otherwise the growth, capped at +100%
function ownScoreOf(c) {
  if (c.recent < MIN_RECENT_ORDERS) return 0
  if (c.isNew) return 1
  return clamp(c.growth)
}

function reasonFor(c, ownScore, best) {
  const pct = Math.round((c.growth ?? 0) * 100)
  const own = c.isNew
    ? `Orders for ${c.category} are new (${c.recent} in the last ${PERIOD_WEEKS} weeks, none before)`
    : `Orders for ${c.category} grew ${pct}%`
  if (ownScore > 0 && best) return `${own} and '${best.term}' is trending`
  if (ownScore > 0) return c.isNew ? own : `${own} (from ${c.previous} to ${c.recent} orders)`
  return `'${best.term}' is trending (your ${c.category} orders did not grow)`
}

// The rising keywords of one category, best first, each keyword once (the same keyword can come from several
// shops' products). Categories are compared with toCategory, so "baked goods" matches "Baked goods".
function risingIdeas(trends, category) {
  const best = new Map() // term -> highest growth
  for (const t of trends || []) {
    if (t.growth > 0 && toCategory(t.category) === category) best.set(t.term, Math.max(t.growth, best.get(t.term) ?? 0))
  }
  return [...best].map(([term, growth]) => ({ term, growth })).sort((a, b) => b.growth - a.growth)
}

// Up to 3 suggestions, best first:
//   [{ category, score, ownScore, trendScore, recent, previous, growth, isNew, term, termGrowth, ideas, reason }]
// trends = [{ category, term, growth }] rising keywords from the server; [] when there is no trend data,
// and then the ranking is by own growth only. Categories with score 0 are left out.
// ideas = up to 3 rising keywords of that category (best first); the score uses only the best one (term).
export function suggestNext(orders, categoryOf, trends = [], now = new Date()) {
  return categoryGrowth(orders, categoryOf, now)
    .map((c) => {
      const ideas = risingIdeas(trends, c.category).slice(0, MAX_IDEAS)
      const best = ideas[0]
      const ownScore = ownScoreOf(c)
      const trendScore = best ? clamp(best.growth) : 0
      const score = OWN_WEIGHT * ownScore + TREND_WEIGHT * trendScore
      return {
        ...c, score, ownScore, trendScore,
        term: best?.term ?? '', termGrowth: best?.growth ?? 0, ideas,
        reason: score > 0 ? reasonFor(c, ownScore, best) : '',
      }
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score || b.recent - a.recent || a.category.localeCompare(b.category))
    .slice(0, MAX_SUGGESTIONS)
}
