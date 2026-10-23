import Product from '../models/Product.js'
import TrendSignal from '../models/TrendSignal.js'

// Owner: Cheyenne
// ONLINE TRENDS for the Trending tab, from the free Wikimedia APIs (no API key, no scraper):
//   1. Wikipedia search  - turns a seller's keyword ("kueh lapis") into an article ("Kue lapis")
//   2. Pageviews API      - how many people read that article each day
// A keyword is "trending" when it got more views in the last 7 days than in the 7 days before.
//
// Why this only gives USEFUL trends (food / items / services):
//   We never download "everything trending" (that is mostly news and celebrities). We only ask about
//   the keywords our own sellers use (product tags + names), and we drop Wikipedia articles that
//   describe people, films, companies, places etc. So every trend is about something we sell.
//
// Results are saved in MongoDB (TrendSignal) and refreshed every 12 hours, so pages load fast
// and Wikimedia is asked at most a few hundred times a day (their limit is far higher).

const USER_AGENT = 'HomlyHauls/1.0 (SMU WAD2 student project; https://github.com/wannsim/WAD2-G1T8)'
const REFRESH_HOURS = 12
const MAX_TERMS = 150
const PARALLEL = 4

// articles that are about these are not things you can buy -> ignored
const NOT_A_PRODUCT = /\b(singer|rapper|actor|actress|footballer|politician|businessman|businesswoman|band|album|song|film|movie|television|tv series|novel|video game|company|corporation|city|town|village|district|country|province|river|footballer|athlete|school|university|record label|magazine|newspaper|software|app|application|operating system|password|programming|protocol|website|disambiguation)\b/i

// common words in product names that are not worth looking up on their own
const STOP_WORDS = new Set(['and', 'with', 'the', 'set', 'pack', 'box', 'kit', 'of', 'for', 'custom', 'homemade', 'handmade', 'mini', 'large', 'small', 'classic', 'special'])

async function getJson(url) {
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT, 'Api-User-Agent': USER_AGENT }, signal: AbortSignal.timeout(8000) })
  if (!res.ok) throw new Error(`${res.status} ${url}`)
  return res.json()
}

const day = (d) => d.toISOString().slice(0, 10).replace(/-/g, '') // 20261021

// keyword -> best Wikipedia article about a food / item / service (or '' if none)
async function findArticle(term) {
  const search = await getJson(
    `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(term)}&srlimit=3&format=json&origin=*`)
  const words = term.split(' ')
  for (const hit of search.query?.search || []) {
    const title = hit.title
    // the article must share a real word with the keyword (stops "Custom name stickers" -> random article)
    const titleLower = title.toLowerCase()
    if (!words.some((w) => w.length > 2 && titleLower.includes(w.slice(0, Math.max(3, w.length - 2))))) continue
    const summary = await getJson(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}`)
    if (summary.type === 'disambiguation') continue
    // e.g. "Keychain (software)" or "American singer": a person, film, company, place, app...
    if (NOT_A_PRODUCT.test(`${title} ${summary.description || ''}`)) continue
    return title
  }
  return ''
}

// article -> page views in the last 7 days and the 7 days before
async function pageViews(article) {
  const end = new Date(Date.now() - 86400000) // yesterday (today is not complete yet)
  const start = new Date(end.getTime() - 13 * 86400000)
  const data = await getJson(
    'https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/user/' +
    `${encodeURIComponent(article.replace(/ /g, '_'))}/daily/${day(start)}/${day(end)}`)
  const views = (data.items || []).map((i) => i.views)
  const recent = views.slice(-7).reduce((a, b) => a + b, 0)
  const previous = views.slice(0, -7).reduce((a, b) => a + b, 0)
  return { recent, previous }
}

// the keywords worth checking: every tag, plus each product name (and its last word: "Banana Walnut Loaf" -> "loaf")
export function keywordsFor(product) {
  const name = String(product.name || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
  const lastWord = name.split(' ').filter((w) => !STOP_WORDS.has(w)).pop()
  return [...new Set([...(product.tags || []).map((t) => t.toLowerCase().trim()), name, lastWord].filter((t) => t && t.length > 2))]
}

let refreshing = false
export async function refreshTrends({ force = false } = {}) {
  if (refreshing) return
  refreshing = true
  try {
    const products = await Product.find({ isAvailable: { $ne: false } }).select('name tags').lean()
    const terms = [...new Set(products.flatMap(keywordsFor))].slice(0, MAX_TERMS)
    const cutoff = new Date(Date.now() - REFRESH_HOURS * 3600000)
    const fresh = new Set((await TrendSignal.find({ updatedAt: { $gte: cutoff } }).select('term').lean()).map((t) => t.term))
    const todo = force ? terms : terms.filter((t) => !fresh.has(t))
    let done = 0
    // a few at a time, to be polite to Wikimedia
    for (let i = 0; i < todo.length; i += PARALLEL) {
      await Promise.all(todo.slice(i, i + PARALLEL).map(async (term) => {
        try {
          const article = await findArticle(term)
          const { recent, previous } = article ? await pageViews(article) : { recent: 0, previous: 0 }
          // small articles jump around a lot, so compare against at least 50 views
          const growth = article ? (recent - previous) / Math.max(previous, 50) : 0
          await TrendSignal.updateOne({ term }, { term, article, recentViews: recent, previousViews: previous, growth }, { upsert: true })
          done++
        } catch (err) {
          // offline / Wikimedia busy: keep the old value and try again next time
        }
      }))
    }
    if (todo.length) console.log(`Trends: updated ${done}/${todo.length} keywords from Wikimedia`)
  } catch (err) {
    console.warn('Trends: could not refresh -', err.message)
  } finally {
    refreshing = false
  }
}

// server.js calls this once MongoDB is connected: refresh now (in the background) and every 12 hours
export function startTrendRefresh() {
  refreshTrends()
  setInterval(refreshTrends, REFRESH_HOURS * 3600000).unref()
}

// term -> { article, growth, recentViews } for every keyword we know about
export async function loadTrendMap() {
  const signals = await TrendSignal.find({ article: { $ne: '' } }).select('term article growth recentViews').lean()
  return new Map(signals.map((s) => [s.term, s]))
}
