// Unit tests for the Gemini filter on YouTube results (utils/geminiFilter.js).
// A fake Gemini replaces the real one, so no API key or network is needed.
//   cd server && pnpm test
import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { filterVideosWithAI, resetAiQuota } from '../utils/geminiFilter.js'

const videos = [
  { id: 'a', snippet: { title: 'Chewy Chocolate Chip Cookies Recipe' } },
  { id: 'b', snippet: { title: 'Minecraft Cookie Farm Tutorial' } },
]
const realFetch = globalThis.fetch
const realLog = console.log
const realWarn = console.warn
let calls

// fake Gemini: answers with `body` and HTTP `status`
const fakeGemini = (status, body) => {
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options })
    return { ok: status === 200, status, statusText: '', json: async () => body }
  }
}
const answer = (keep) => ({ candidates: [{ content: { parts: [{ text: JSON.stringify({ keep }) }] } }], usageMetadata: {} })

beforeEach(() => {
  calls = []
  process.env.GEMINI_API_KEY = 'test-key'
  resetAiQuota()
  console.log = () => {} // keep test output clean
  console.warn = () => {}
})
afterEach(() => {
  globalThis.fetch = realFetch
  console.log = realLog
  console.warn = realWarn
  delete process.env.GEMINI_API_KEY
})

test('keeps only the videos Gemini says are about the product', async () => {
  fakeGemini(200, answer(['a']))
  const kept = await filterVideosWithAI('cookies', videos)
  assert.deepEqual(kept.map((v) => v.id), ['a'])
  assert.equal(calls.length, 1)
  assert.equal(calls[0].options.headers['x-goog-api-key'], 'test-key')
  assert.match(calls[0].options.body, /Minecraft Cookie Farm/) // the titles are sent to Gemini
})

test('no GEMINI_API_KEY: does not call Gemini and keeps every video', async () => {
  delete process.env.GEMINI_API_KEY
  fakeGemini(200, answer([]))
  const kept = await filterVideosWithAI('cookies', videos)
  assert.equal(kept.length, 2)
  assert.equal(calls.length, 0)
})

test('Gemini down or bad key: keeps the rule-based result instead of failing', async () => {
  fakeGemini(500, { error: { message: 'server error' } })
  assert.equal((await filterVideosWithAI('cookies', videos)).length, 2)
  fakeGemini(403, { error: { message: 'API key not valid' } })
  assert.equal((await filterVideosWithAI('cookies', videos)).length, 2)
})

test('free quota used up (429): stops asking Gemini for the rest of the refresh', async () => {
  fakeGemini(429, { error: { message: 'quota exceeded' } })
  assert.equal((await filterVideosWithAI('cookies', videos)).length, 2)
  assert.equal((await filterVideosWithAI('cake', videos)).length, 2)
  assert.equal(calls.length, 1) // the second keyword did not call Gemini again
})

test('empty or broken answer: keeps every video', async () => {
  fakeGemini(200, { candidates: [{ finishReason: 'SAFETY' }] })
  assert.equal((await filterVideosWithAI('cookies', videos)).length, 2)
  fakeGemini(200, { candidates: [{ content: { parts: [{ text: 'not json' }] } }] })
  assert.equal((await filterVideosWithAI('cookies', videos)).length, 2)
})
