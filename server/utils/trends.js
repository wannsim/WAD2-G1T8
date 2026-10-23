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
const MATCH_VERSION = 3 // bump when findArticle's rules change, so old matches are redone
const MAX_TERMS = 150
const PARALLEL = 4

// articles that are about these are not things you can buy -> ignored
const NOT_A_PRODUCT = /\b(singer|rapper|actor|actress|footballer|baseball|basketball|player|politician|businessman|businesswoman|band|album|song|film|movie|television|tv series|novel|video game|company|corporation|brand|chain|restaurant|coffeehouse|city|town|village|district|country|province|river|athlete|school|university|record label|magazine|newspaper|software|app|application|operating system|password|programming|protocol|website|domain|currency|language|ethnic group|disambiguation)s?\b|^list of/i

// common words in product names that are not worth looking up on their own
const STOP_WORDS = new Set(['and', 'with', 'the', 'set', 'pack', 'box', 'kit', 'of', 'for', 'custom', 'homemade', 'handmade', 'mini', 'large', 'small', 'classic', 'special'])

async function getJson(url, retry = true) {
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT, 'Api-User-Agent': USER_AGENT }, signal: AbortSignal.timeout(8000) })
  // Wikimedia says "slow down" (429) or is busy (503): wait a moment and try once more
  if ((res.status === 429 || res.status === 503) && retry) {
    await new Promise((r) => setTimeout(r, 1500))
    return getJson(url, false)
  }
  if (!res.ok) throw new Error(`${res.status} ${url}`)
  return res.json()
}

const day = (d) => d.toISOString().slice(0, 10).replace(/-/g, '') // 20261021

// every accepted article must ALSO sound like something you can buy (food, item, craft, service) -
// this drops ideas like "Birthday", "Health" or "Japanese language" that are only tags, not products
const PRODUCT_LIKE = /\b(food|dish|meal|drink|beverage|cake|dessert|pastry|pastries|bread|biscuit|cookie|snack|sweet|confection|kueh|kuih|tea|coffee|juice|cuisine|rice|grain|flour|noodle|dumpling|soup|curry|sauce|condiment|chili|spice|herb|fruit|vegetable|meat|pork|chicken|beef|fish|seafood|prawn|shrimp|toy|doll|craft|handicraft|crochet|knit\w*|yarn|fabric|lace|textile|jewel\w*|bead\w*|decorative|ornament|decoration|candle|keychain|card|gift|art|artwork|painting|portrait|print|sticker|label|accessory|clothing|garment|bag|soap|cosmetic|plant|flower|service|lesson|workshop|cleaning|repair)(e?s)?\b/i

// rough "same word" check: crochet ~ crocheted, keychain ~ keychains, bead ~ beads
const stem = (w) => w.slice(0, Math.max(3, w.length - 2))
const sameWord = (a, b) => a.startsWith(stem(b)) || b.startsWith(stem(a))
// how many keyword words appear in this text ("Ginger tea" has 2 of "lemongrass ginger tea")
const wordsFound = (text, words) => {
  const tokens = String(text || '').toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 2)
  return words.filter((w) => tokens.some((t) => sameWord(t, w))).length
}
// title / redirect must contain at least HALF the keyword words ("Frozen fries" has only 1 of 4 in "masala dosa frozen batter")
const enoughWords = (text, words) => wordsFound(text, words) >= Math.ceil(words.length / 2)

// what we actually search for: the keyword without filler words ("teh tarik kit" -> "teh tarik")
export function searchWords(term) {
  return term.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !STOP_WORDS.has(w))
}

// keyword -> best Wikipedia article about a food / item / service (or '' if none)
// log(step, text) is optional: scratchpad demos / debugging print every decision
export async function findArticle(term, log = () => {}) {
  const words = searchWords(term)
  if (words.length === 0) return ''
  const query = words.join(' ')
  const search = await getJson('https://en.wikipedia.org/w/api.php?action=query&list=search' +
    `&srsearch=${encodeURIComponent(query)}&srlimit=5&srprop=snippet|redirecttitle|sectiontitle&format=json&origin=*`)
  const hits = search.query?.search || []
  log(1, `search "${query}" -> ${hits.map((h) => h.title).join(', ') || 'nothing'}`)

  // STEP 2: evidence for each result
  //   strong: the title, or another name that redirects to it ("Plushie" -> "Stuffed toy"), shares a word
  //   weak:   every keyword word is highlighted in the article text Wikipedia matched
  const candidates = hits.map((h) => {
    const highlighted = [...h.snippet.matchAll(/<span class="searchmatch">(.*?)<\/span>/g)].map((m) => m[1].toLowerCase())
    const allFound = words.every((w) => highlighted.some((x) => sameWord(x, w)))
    const strong = enoughWords(h.title, words) ? 'title' : enoughWords(h.redirecttitle, words) ? `redirect "${h.redirecttitle}"` : ''
    return { title: h.title, strong, weak: !strong && allFound, highlighted }
  })
  candidates.forEach((c) => log(2, `"${c.title}": ${c.strong ? `STRONG (${c.strong})` : c.weak ? `WEAK (all words in text: ${[...new Set(c.highlighted)].join(', ')})` : 'no evidence -> skip'}`))

  // strong matches first (in Wikipedia's order), then weak ones
  for (const c of [...candidates.filter((c) => c.strong), ...candidates.filter((c) => c.weak)]) {
    const summary = await getJson(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(c.title.replace(/ /g, '_'))}`)
    const description = summary.description || ''
    if (summary.type === 'disambiguation') { log(3, `"${c.title}": disambiguation page -> reject`); continue }
    // e.g. "Keychain (software)" or "American singer": a person, film, company, place, app...
    const notProduct = `${c.title} ${description}`.match(NOT_A_PRODUCT)
    if (notProduct) { log(3, `"${c.title}" (${description}): "${notProduct[0]}" -> not a product, reject`); continue }
    // must sound like something you can buy
    if (!PRODUCT_LIKE.test(`${c.title} ${description}`)) { log(3, `"${c.title}" (${description}): not food / item / service -> reject`); continue }
    log(3, `"${c.title}" (${description || 'no description'}): ACCEPTED`)
    return c.title
  }
  log(3, 'no useful article')
  return ''
}

// article -> page views in the last 7 days and the 7 days before
export async function pageViews(article) {
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
    const fresh = new Set((await TrendSignal.find({ updatedAt: { $gte: cutoff }, version: MATCH_VERSION }).select('term').lean()).map((t) => t.term))
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
          await TrendSignal.updateOne({ term }, { term, article, recentViews: recent, previousViews: previous, growth, version: MATCH_VERSION }, { upsert: true })
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
