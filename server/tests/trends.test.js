// Unit tests for the YouTube trend maths (utils/trends.js).
// A fake YouTube replaces the real one, so no API key, network or database is needed.
//   cd server && pnpm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { searchWords, aboutKeyword, growthFor, keywordsFor, youtubeInterest } from '../utils/trends.js'

const DAY = 86400000
const ago = (d) => new Date(Date.now() - d * DAY).toISOString()

test('searchWords drops filler words', () => {
  assert.deepEqual(searchWords('Teh Tarik Kit'), ['teh', 'tarik'])
  assert.deepEqual(searchWords('box of homemade cookies'), ['cookies'])
})

test('keywordsFor uses tags, the full name and its last word', () => {
  const words = keywordsFor({ name: 'Matcha Cupcakes', tags: ['Cupcake', 'matcha'] })
  assert.ok(words.includes('matcha cupcakes'))
  assert.ok(words.includes('cupcakes'))
  assert.ok(words.includes('cupcake'))
})

test('aboutKeyword keeps real videos about the product and drops music / unrelated ones', () => {
  const words = ['tea']
  assert.equal(aboutKeyword({ snippet: { title: 'Homemade ginger tea recipe', categoryId: '26' } }, words), true)
  assert.equal(aboutKeyword({ snippet: { title: 'TEA (Official Music Video)', categoryId: '10' } }, words), false) // music
  assert.equal(aboutKeyword({ snippet: { title: 'Singapore MRT vlog', categoryId: '22' } }, words), false) // not about tea
})

test('growthFor: first week uses views per day, later weeks compare with a week ago', () => {
  const r = { recentVideos: 2, recentViews: 210000, recentPerDay: 90000, previousPerDay: 4000 }
  const first = growthFor(r, [])
  assert.equal(first.method, 'per-day estimate')
  assert.equal(first.growth, (90000 - 4000) / 4000)

  const history = [{ at: new Date(Date.now() - 7 * DAY), views: 100000 }]
  const later = growthFor(r, history)
  assert.equal(later.method, 'week-on-week')
  assert.equal(later.growth, (210000 - 100000) / 100000)

  assert.equal(growthFor({ recentVideos: 0 }).growth, 0) // nothing uploaded -> no trend
})

test('youtubeInterest counts only matching videos, split into this week and last week', async () => {
  const videos = [
    { id: 'a', title: 'Best bubble tea in Singapore', cat: '26', at: ago(2), views: 150000 },
    { id: 'b', title: 'TEA (Official Music Video)', cat: '10', at: ago(1), views: 9000000 },
    { id: 'c', title: 'Teh tarik vs milk tea', cat: '22', at: ago(10), views: 40000 },
  ]
  const realFetch = globalThis.fetch
  globalThis.fetch = async (url) => {
    const u = new URL(url)
    const body = u.pathname.endsWith('/search')
      ? { items: videos.map((v) => ({ id: { videoId: v.id } })) }
      : { items: videos.map((v) => ({ id: v.id, snippet: { title: v.title, categoryId: v.cat, publishedAt: v.at }, statistics: { viewCount: String(v.views) } })) }
    return { ok: true, status: 200, json: async () => body }
  }
  try {
    const r = await youtubeInterest('tea', 'FAKE_KEY')
    assert.equal(r.recentViews, 150000)   // the music video is ignored
    assert.equal(r.recentVideos, 1)
    assert.equal(r.previousViews, 40000)
    assert.equal(r.topVideo.id, 'a')
  } finally {
    globalThis.fetch = realFetch
  }
})
