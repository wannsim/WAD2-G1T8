import Product from '../models/Product.js'
import TrendSignal from '../models/TrendSignal.js'

// Owner: Cheyenne
// ONLINE TRENDS for the Trending tab, from the YouTube Data API v3 (free key, put it in config.env):
//   YOUTUBE_API_KEY=your-key
// For each keyword our sellers use (product tags + names) we ask YouTube:
//   1. search.list  - the most-watched videos about it uploaded in Singapore in the last 14 days (100 units)
//   2. videos.list  - how many views each of those videos has (1 unit)
// Every day we save "views of matching videos uploaded in the last 7 days" for each keyword.
// A keyword is "trending" when that number is higher than it was 7 days ago (same measure, a week apart,
// so it is a fair comparison). In the first week, before there is any history, we estimate it instead:
// views per day of this week's uploads vs views per day of last week's uploads (each video's views
// divided by how many days it has been online).
//
// Why this only gives USEFUL trends (food / items / services):
//   We never download "everything trending" (that is mostly music and celebrities). We only ask about
//   the keywords our own sellers use, we keep only videos whose title / tags actually contain the
//   keyword, and we drop music, gaming, news and sports videos. So every trend is about something we sell.
//
// Google's free limits: 10,000 units a day AND only 100 searches a day (one search per keyword).
// So we check the 40 most-used keywords once a day (40 searches, about 4,000 units), which leaves
// room for teammates' servers and restarts. Every server shares the same saved results in MongoDB,
// so a keyword checked by anyone in the last 24 hours is not searched again. Results are saved in MongoDB (TrendSignal), so pages load fast and
// restarting the server does not spend the quota again. No key = no online trends; the Trending tab
// still works from our own orders, saves and views.

const API = 'https://www.googleapis.com/youtube/v3'
const REFRESH_HOURS = 24
const SOURCE_VERSION = 5 // 1-3 were Wikimedia, 4 compared raw totals; bump when the rules below change, so old results are redone
const MAX_TERMS = 40 // searches per day (Google allows 100)
const PARALLEL = 4
const DAY = 86400000
const HISTORY_DAYS = 15 // keep about two weeks of daily numbers per keyword
const MIN_VIEWS = 1000  // a handful of views jumps around a lot, so compare against at least this many
const MIN_PER_DAY = MIN_VIEWS / 7

// YouTube category ids that are never about things you can buy: Music, Sports, Gaming, News & Politics
const NOT_A_PRODUCT_CATEGORY = new Set(['10', '17', '20', '25'])

// common words in product names that are not worth looking up on their own
const STOP_WORDS = new Set(['and', 'with', 'the', 'set', 'pack', 'box', 'kit', 'of', 'for', 'custom', 'homemade', 'handmade', 'mini', 'large', 'small', 'classic', 'special'])

class QuotaError extends Error {}

async function getJson(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
  if (res.status === 403 || res.status === 429) {
    // quota used up (403 quotaExceeded, 429 too many searches today) or a bad key: stop for today instead of failing 40 times
    const body = await res.json().catch(() => ({}))
    throw new QuotaError(body.error?.message || 'YouTube refused the request (check YOUTUBE_API_KEY)')
  }
  if (!res.ok) throw new Error(`${res.status} ${url.replace(/key=[^&]+/, 'key=***')}`)
  return res.json()
}

// rough "same word" check: crochet ~ crocheted, keychain ~ keychains, bead ~ beads
const stem = (w) => w.slice(0, Math.max(3, w.length - 2))
const sameWord = (a, b) => a.startsWith(stem(b)) || b.startsWith(stem(a))
// how many keyword words appear in this text ("Ginger tea recipe" has 2 of "lemongrass ginger tea")
const wordsFound = (text, words) => {
  const tokens = String(text || '').toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 2)
  return words.filter((w) => tokens.some((t) => sameWord(t, w))).length
}

// what we actually search for: the keyword without filler words ("teh tarik kit" -> "teh tarik")
export function searchWords(term) {
  return term.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !STOP_WORDS.has(w))
}

// is this video really about the keyword? title + tags must contain at least half its words,
// and it must not be music / sports / gaming / news
export function aboutKeyword(video, words) {
  if (NOT_A_PRODUCT_CATEGORY.has(video.snippet?.categoryId)) return false
  const text = `${video.snippet?.title || ''} ${(video.snippet?.tags || []).join(' ')}`
  return wordsFound(text, words) >= Math.ceil(words.length / 2)
}

// keyword -> views of matching videos uploaded this week vs last week
// log(step, text) is optional: scratchpad demos / debugging print every decision
export async function youtubeInterest(term, key, log = () => {}) {
  const words = searchWords(term)
  const empty = { query: '', recentViews: 0, previousViews: 0, recentPerDay: 0, previousPerDay: 0, recentVideos: 0, previousVideos: 0, topVideo: null }
  if (words.length === 0) return empty
  const query = words.join(' ')
  const now = Date.now()
  const weekAgo = now - 7 * DAY
  const search = await getJson(`${API}/search?part=id&type=video&order=viewCount&maxResults=50` +
    `&regionCode=SG&relevanceLanguage=en&safeSearch=strict` +
    `&publishedAfter=${new Date(now - 14 * DAY).toISOString()}&q=${encodeURIComponent(query)}&key=${key}`)
  const ids = (search.items || []).map((i) => i.id?.videoId).filter(Boolean)
  log('search', `"${query}" -> ${ids.length} videos from the last 14 days`)
  if (ids.length === 0) return { ...empty, query }

  const details = await getJson(`${API}/videos?part=snippet,statistics&id=${ids.join(',')}&key=${key}`)
  const result = { ...empty, query }
  for (const v of details.items || []) {
    if (!aboutKeyword(v, words)) {
      log('skip', `${v.snippet?.title} (not about "${query}")`)
      continue
    }
    const views = Number(v.statistics?.viewCount || 0)
    const published = new Date(v.snippet.publishedAt).getTime()
    const perDay = views / Math.max((now - published) / DAY, 1) // a 2-day-old video is not compared with a 12-day-old one on totals
    if (published >= weekAgo) {
      result.recentViews += views
      result.recentPerDay += perDay
      result.recentVideos++
      if (!result.topVideo || views > result.topVideo.views) result.topVideo = { id: v.id, title: v.snippet.title, views }
    } else {
      result.previousViews += views
      result.previousPerDay += perDay
      result.previousVideos++
    }
  }
  log('views', `this week's uploads ${result.recentViews} views (${result.recentVideos} videos, ${Math.round(result.recentPerDay)}/day), ` +
    `last week's ${result.previousViews} (${result.previousVideos} videos, ${Math.round(result.previousPerDay)}/day)`)
  return result
}

// growth from today's numbers + the saved daily history: { growth, method }
export function growthFor(r, history = [], now = Date.now()) {
  if (!r.recentVideos) return { growth: 0, method: 'none' }
  // the saved value closest to 7 days ago (6-9 days old counts)
  const weekAgo = history
    .filter((h) => { const age = (now - new Date(h.at).getTime()) / DAY; return age >= 6 && age <= 9 })
    .sort((a, b) => Math.abs(now - 7 * DAY - new Date(a.at)) - Math.abs(now - 7 * DAY - new Date(b.at)))[0]
  if (weekAgo) return { growth: (r.recentViews - weekAgo.views) / Math.max(weekAgo.views, MIN_VIEWS), method: 'week-on-week' }
  return { growth: (r.recentPerDay - r.previousPerDay) / Math.max(r.previousPerDay, MIN_PER_DAY), method: 'per-day estimate' }
}

export function keywordsFor(product) {
  const name = String(product.name || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
  const lastWord = name.split(' ').filter((w) => !STOP_WORDS.has(w)).pop()
  return [...new Set([...(product.tags || []).map((t) => t.toLowerCase().trim()), name, lastWord].filter((t) => t && t.length > 2))]
}

let refreshing = false
let warnedNoKey = false
export async function refreshTrends({ force = false } = {}) {
  const key = process.env.YOUTUBE_API_KEY
  if (!key) {
    if (!warnedNoKey) console.log('Trends: no YOUTUBE_API_KEY in config.env - Trending uses on-site activity only')
    warnedNoKey = true
    return
  }
  if (refreshing) return
  refreshing = true
  try {
    const products = await Product.find({ isAvailable: { $ne: false } }).select('name tags').lean()
    // tags first (short, shared by many products), so the 40-keyword budget covers the most products
    const counts = new Map()
    products.flatMap(keywordsFor).forEach((t) => counts.set(t, (counts.get(t) || 0) + 1))
    const terms = [...counts.keys()].sort((a, b) => counts.get(b) - counts.get(a)).slice(0, MAX_TERMS)
    const cutoff = new Date(Date.now() - REFRESH_HOURS * 3600000)
    const saved = new Map((await TrendSignal.find({ term: { $in: terms } }).select('term history updatedAt version').lean()).map((t) => [t.term, t]))
    const isFresh = (t) => saved.get(t)?.version === SOURCE_VERSION && saved.get(t).updatedAt >= cutoff
    const todo = force ? terms : terms.filter((t) => !isFresh(t))
    let done = 0
    let quotaHit = ''
    for (let i = 0; i < todo.length && !quotaHit; i += PARALLEL) {
      await Promise.all(todo.slice(i, i + PARALLEL).map(async (term) => {
        try {
          const r = await youtubeInterest(term, key)
          const now = Date.now()
          // history from older versions measured something else, so start it again
          const old = saved.get(term)
          const past = old?.version === SOURCE_VERSION ? old.history || [] : []
          const { growth, method } = growthFor(r, past, now)
          // one value per day (a forced refresh on the same day replaces today's), only the last 15 days
          const today = new Date(now).toISOString().slice(0, 10)
          const history = [...past.filter((h) => new Date(h.at).toISOString().slice(0, 10) !== today && now - new Date(h.at) < HISTORY_DAYS * DAY),
            { at: new Date(now), views: r.recentViews }]
          await TrendSignal.updateOne({ term }, {
            term, query: r.query, recentViews: r.recentViews, previousViews: r.previousViews,
            recentPerDay: r.recentPerDay, previousPerDay: r.previousPerDay,
            recentVideos: r.recentVideos, previousVideos: r.previousVideos, growth, method, history,
            topVideoId: r.topVideo?.id || '', topVideoTitle: r.topVideo?.title || '', version: SOURCE_VERSION,
          }, { upsert: true })
          done++
        } catch (err) {
          if (err instanceof QuotaError) quotaHit = err.message
          // offline / YouTube busy: keep the old value and try again next time
        }
      }))
    }
    if (todo.length) console.log(`Trends: updated ${done}/${todo.length} keywords from YouTube`)
    if (quotaHit) console.warn(`Trends: stopped early - ${quotaHit}`)
  } catch (err) {
    console.warn('Trends: could not refresh -', err.message)
  } finally {
    refreshing = false
  }
}

// server.js calls this once MongoDB is connected: refresh now (in the background) and once a day
export function startTrendRefresh() {
  refreshTrends()
  setInterval(refreshTrends, REFRESH_HOURS * 3600000).unref()
}

// term -> { term, growth, recentViews, topVideoTitle } for every keyword YouTube found videos for
export async function loadTrendMap() {
  const signals = await TrendSignal.find({ version: SOURCE_VERSION, recentVideos: { $gt: 0 } })
    .select('term growth recentViews topVideoId topVideoTitle').lean()
  return new Map(signals.map((s) => [s.term, s]))
}
