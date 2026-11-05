// Owner: Wan Sim
// Forecast and what to make next (seller Analytics page).
// Business problem: home sellers don't know how many orders to expect or when, so they set slot capacity
// and stock by guessing. These pure functions turn their completed orders into a weekly estimate.
// Every formula is explained in plain words, with a worked example, in ALGORITHMS.md.
// Tests: __tests__/forecast.spec.js (written first).

const DAY_MS = 86400000
const WEEK_MS = 7 * DAY_MS
// Singapore is always UTC+8 (no daylight saving), so "add 8 hours, then read the UTC date" gives the
// Singapore date. Dates are stored in UTC: an order at 17:30 UTC is already 01:30 the next day here.
const SINGAPORE_OFFSET_MS = 8 * 60 * 60 * 1000
const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

export const MIN_WEEKS = 4 // fewer full weeks than this -> "Not enough orders yet to forecast"
export const MIN_ORDERS = 10 // fewer completed orders than this -> the same message
// The 2 busiest weekdays must have at least 40% of completed orders before we suggest them.
// An even spread would give any 2 of the 7 days 2/7 = about 29%, so 40% means clearly busier than that.
export const MIN_TOP_SHARE = 0.40
export const EVEN_SPREAD_MESSAGE = 'Your orders are spread fairly evenly across the week.'
// newest week counts 4 times as much as the oldest of the last 4 weeks
const LEVEL_WEIGHTS = [1, 2, 3, 4]
// the trend line only looks at the last 12 weeks, so very old habits don't steer it
const TREND_WEEKS = 12

// The time that matters for planning is when the order is handed over (pickup / delivery).
// After a reschedule is accepted the server copies the new time into requestedTime, so it is always the final time.
function orderTime(order) {
  return new Date(order.requestedTime || order.createdAt).getTime()
}

function completedOrders(orders) {
  return (orders || []).filter((order) => order?.status === 'completed' && Number.isFinite(orderTime(order)))
}

// order total in cents (a missing or broken price counts as 0, the order itself still counts)
function cents(amount) {
  return typeof amount === 'number' && Number.isFinite(amount) && amount > 0 ? Math.round(amount * 100) : 0
}

// 0 = Monday ... 6 = Sunday, in Singapore time
function singaporeWeekday(millis) {
  return (new Date(millis + SINGAPORE_OFFSET_MS).getUTCDay() + 6) % 7
}

// midnight on the Monday of that week, in Singapore time (kept "shifted": read it with toISOString)
function singaporeMonday(millis) {
  const singaporeMidnight = Math.floor((millis + SINGAPORE_OFFSET_MS) / DAY_MS) * DAY_MS
  return singaporeMidnight - singaporeWeekday(millis) * DAY_MS
}

const weekLabel = (shiftedMillis) => new Date(shiftedMillis).toISOString().slice(0, 10) // "2026-10-26" = week starting Mon 26 Oct

// a) Completed orders per Singapore week (Monday-Sunday): [{ week, orders, revenueCents }], oldest first.
// From the week of the first completed order up to LAST week. This week is left out because it isn't
// finished (half a week would look like a drop). Weeks with no orders are filled in as 0.
export function weeklyTotals(orders, now = new Date()) {
  const thisWeek = singaporeMonday(new Date(now).getTime())
  const weeks = new Map()
  for (const order of completedOrders(orders)) {
    const monday = singaporeMonday(orderTime(order))
    if (monday >= thisWeek) continue
    const week = weeks.get(monday) || { orders: 0, revenueCents: 0 }
    week.orders++
    week.revenueCents += cents(order.totalPrice)
    weeks.set(monday, week)
  }
  if (!weeks.size) return []

  const result = []
  for (let monday = Math.min(...weeks.keys()); monday < thisWeek; monday += WEEK_MS) {
    const week = weeks.get(monday) || { orders: 0, revenueCents: 0 }
    result.push({ week: weekLabel(monday), ...week })
  }
  return result
}

// enough history to forecast? at least 4 full weeks AND at least 10 completed orders
export function hasEnoughHistory(weekly) {
  const total = weekly.reduce((sum, w) => sum + w.orders, 0)
  return weekly.length >= MIN_WEEKS && total >= MIN_ORDERS
}

// Least-squares trend line through the points (1, y1), (2, y2) ... : y = intercept + slope * x
function trendLine(values) {
  const n = values.length
  const meanX = (n + 1) / 2
  const meanY = values.reduce((sum, y) => sum + y, 0) / n
  let top = 0
  let bottom = 0
  values.forEach((y, i) => {
    top += (i + 1 - meanX) * (y - meanY)
    bottom += (i + 1 - meanX) ** 2
  })
  const slope = top / bottom
  return { slope, intercept: meanY - slope * meanX }
}

// b) Estimate for the next weeks: [{ week, expected, low, high }], or [] when there isn't enough history.
//   level  = weighted average of the last 4 weeks (weights 1, 2, 3, 4 - newest counts most)
//   slope  = how many orders per week the trend line gains (or loses), from the last 12 weeks
//   the weighted average sits about 1 week behind the newest week (its "centre"), so for h weeks ahead:
//   expected = level + slope * (h + lag)                      never below 0
//   spread   = typical miss of the trend line on past weeks = sqrt(sum of misses squared / (weeks - 2))
//   low/high = expected -/+ spread * sqrt(h)                  further ahead = less sure = wider
// The range is only how far past weeks typically were from the line - NOT a guarantee.
export function forecastWeeks(weekly, weeksAhead = 4) {
  if (!hasEnoughHistory(weekly)) return []

  const last = weekly.slice(-LEVEL_WEIGHTS.length).map((w) => w.orders)
  const weightSum = LEVEL_WEIGHTS.reduce((sum, w) => sum + w, 0)
  const level = LEVEL_WEIGHTS.reduce((sum, w, i) => sum + w * last[i], 0) / weightSum
  // centre of the weights (1*1 + 2*2 + 3*3 + 4*4) / 10 = week 3 of 4 -> 1 week behind the newest week
  const centre = LEVEL_WEIGHTS.reduce((sum, w, i) => sum + w * (i + 1), 0) / weightSum
  const lag = LEVEL_WEIGHTS.length - centre

  const recent = weekly.slice(-TREND_WEEKS).map((w) => w.orders)
  const { slope, intercept } = trendLine(recent)
  // divide by (weeks - 2): the line was fitted to these same weeks (2 numbers: slope + intercept),
  // so it fits them better than it will fit the future
  const missesSquared = recent.reduce((sum, y, i) => sum + (y - (intercept + slope * (i + 1))) ** 2, 0)
  const spread = Math.sqrt(missesSquared / (recent.length - 2))

  const lastMonday = Date.parse(`${weekly[weekly.length - 1].week}T00:00:00Z`)
  const result = []
  for (let h = 1; h <= weeksAhead; h++) {
    const expected = Math.max(0, level + slope * (h + lag))
    const margin = spread * Math.sqrt(h)
    result.push({
      week: weekLabel(lastMonday + h * WEEK_MS),
      expected,
      low: Math.max(0, expected - margin),
      high: expected + margin,
    })
  }
  return result
}

// "Saturday" -> "Saturdays"
const plural = (day) => `${day}s`

// c) Completed orders per weekday (Monday first, Singapore time) and the 2 busiest days with a suggestion.
// No suggestion under 10 completed orders: too few to say which days are really busier.
// Top 2 days under 40% of orders: no days are picked (top = []), the suggestion says the spread is even.
// A tie goes to the day with more revenue, then to the earlier day in the week.
export function busiestSlots(orders) {
  const days = DAY_NAMES.map((day) => ({ day, orders: 0, revenueCents: 0 }))
  const done = completedOrders(orders)
  for (const order of done) {
    const day = days[singaporeWeekday(orderTime(order))]
    day.orders++
    day.revenueCents += cents(order.totalPrice)
  }
  if (done.length < MIN_ORDERS) return { days, top: [], suggestion: '' }

  const top = [...days]
    .filter((d) => d.orders > 0)
    .sort((a, b) => b.orders - a.orders || b.revenueCents - a.revenueCents)
    .slice(0, 2)
  const share = top.reduce((sum, d) => sum + d.orders, 0) / done.length
  if (share < MIN_TOP_SHARE) return { days, top: [], suggestion: EVEN_SPREAD_MESSAGE }
  const names = top.map((d) => plural(d.day)).join(' and ')
  return {
    days,
    top: top.map((d) => d.day),
    suggestion: `Add more slot capacity on ${names} (${Math.round(share * 100)}% of your completed orders).`,
  }
}

// d) Would this method have worked on this shop's past? Hide the last `holdout` weeks, forecast them from
// the weeks before, and compare with what really happened. The naive guess is "same as last week": the
// last week it could see, repeated. Error = average of |guess - actual| in orders per week (lower is better).
// Needs 4 weeks to learn from + the hidden weeks; otherwise null.
export function backtest(weekly, holdout = 4) {
  if (weekly.length < MIN_WEEKS + holdout) return null
  const train = weekly.slice(0, -holdout)
  const hidden = weekly.slice(-holdout)
  const forecast = forecastWeeks(train, holdout)
  if (!forecast.length) return null // the learning weeks have fewer than 10 orders

  const lastSeen = train[train.length - 1].orders
  const weeks = hidden.map((w, i) => ({ week: w.week, actual: w.orders, forecast: forecast[i].expected, naive: lastSeen }))
  const averageMiss = (key) => weeks.reduce((sum, w) => sum + Math.abs(w[key] - w.actual), 0) / weeks.length
  return { weeks, methodError: averageMiss('forecast'), naiveError: averageMiss('naive') }
}

// e) Rolling backtest: the same check as backtest, but from EVERY possible cut-off instead of only the last
// one, so one unusual month can't decide the result. For each cut-off with at least 4 weeks before it and
// `horizon` weeks after it: forecast those weeks from the weeks before, and compare with what really
// happened. Cut-offs with fewer than 10 orders before them are skipped (no forecast is possible there).
// Returns the number of cut-offs used and the average miss (orders per week) of each method, or null.
// The weights are NOT tuned to win this check: it is here to show honestly how good the method is.
export function rollingBacktest(weekly, horizon = 4) {
  let cutoffs = 0
  let methodMiss = 0
  let naiveMiss = 0
  for (let cut = MIN_WEEKS; cut + horizon <= weekly.length; cut++) {
    const train = weekly.slice(0, cut)
    const forecast = forecastWeeks(train, horizon)
    if (!forecast.length) continue
    const lastSeen = train[train.length - 1].orders
    for (let h = 0; h < horizon; h++) {
      const actual = weekly[cut + h].orders
      methodMiss += Math.abs(forecast[h].expected - actual)
      naiveMiss += Math.abs(lastSeen - actual)
    }
    cutoffs++
  }
  if (!cutoffs) return null
  return { cutoffs, methodError: methodMiss / (cutoffs * horizon), naiveError: naiveMiss / (cutoffs * horizon) }
}
