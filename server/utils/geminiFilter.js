// Owner: Cheyenne
// AI FILTER for YouTube trends, using Google's Gemini API (free key from aistudio.google.com).
// Put it in config.env:  GEMINI_API_KEY=your-key   (optional: GEMINI_MODEL=another-model)
// The word-match rules in trends.js still let through videos that only mention the keyword
// ("cookie" -> a Minecraft cookie farm, "candle" -> a horror short). After those rules, we send the
// remaining video titles to Gemini and keep only the ones really about buying / making / eating that
// product. No key, quota used up, or Gemini is down = we keep the rule-based result, so trends still work.
// Every decision is printed in the server terminal.

const API = 'https://generativelanguage.googleapis.com/v1beta/models'
// Flash-Lite has the biggest free daily quota; we make about 40 calls a day
const DEFAULT_MODEL = 'gemini-flash-lite-latest'

const SYSTEM_PROMPT =
  'You filter YouTube videos for a Singapore marketplace of home-based businesses (home bakers, cooks, ' +
  'crafters, small service providers). Given a product keyword and some videos, keep only videos that are ' +
  'about that product as something people buy, make, cook, eat, use or learn (recipes, reviews, tutorials, ' +
  'food vlogs, shopping hauls, DIY). Drop videos that only mention the word in another sense: games, music, ' +
  'celebrities, memes, news, unrelated stories. When unsure, drop it. Reply with the ids of the videos to keep.'

const SCHEMA = {
  type: 'OBJECT',
  properties: { keep: { type: 'ARRAY', items: { type: 'STRING' } } },
  required: ['keep'],
}

let quotaHit = false // once Gemini says "no more today", stop asking until the next daily refresh

export const aiFilterEnabled = () => Boolean(process.env.GEMINI_API_KEY)
export const resetAiQuota = () => { quotaHit = false }

// videos: YouTube video objects (id, snippet.title, snippet.tags, snippet.description)
// returns the subset Gemini says is about `term`, or all of them if Gemini can't be used
export async function filterVideosWithAI(term, videos) {
  if (!aiFilterEnabled() || quotaHit || videos.length === 0) return videos
  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL

  const list = videos.map((v) => ({
    id: v.id,
    title: v.snippet?.title || '',
    tags: (v.snippet?.tags || []).slice(0, 10),
    description: String(v.snippet?.description || '').slice(0, 200),
  }))

  try {
    const res = await fetch(`${API}/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
      signal: AbortSignal.timeout(20000),
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: 'user', parts: [{ text: `Product keyword: "${term}"\n\nVideos:\n${JSON.stringify(list, null, 2)}` }] }],
        generationConfig: { responseMimeType: 'application/json', responseSchema: SCHEMA },
      }),
    })

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      const msg = body.error?.message || res.statusText
      if (res.status === 429) {
        quotaHit = true
        console.warn(`[Gemini] free quota used up for today - rule-based filter only until tomorrow (${msg})`)
      } else if (res.status === 400 || res.status === 403) {
        console.warn(`[Gemini] request refused - check GEMINI_API_KEY (${msg})`)
      } else if (res.status === 404) {
        console.warn(`[Gemini] model "${model}" not found - set GEMINI_MODEL in config.env (${msg})`)
      } else {
        console.warn(`[Gemini] error ${res.status}: ${msg} - keeping rule-based result`)
      }
      return videos
    }

    const data = await res.json()
    const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('')
    if (!text) {
      console.warn(`[Gemini] "${term}": empty answer (${data.candidates?.[0]?.finishReason || data.promptFeedback?.blockReason || 'unknown'}) - keeping rule-based result`)
      return videos
    }
    const keep = new Set(JSON.parse(text).keep)

    // show exactly what Gemini decided for every video
    const usage = data.usageMetadata || {}
    console.log(`[Gemini] "${term}" (${model}, ${usage.promptTokenCount ?? '?'} in / ${usage.candidatesTokenCount ?? '?'} out tokens) kept ${keep.size} of ${list.length}:`)
    for (const v of list) console.log(`  ${keep.has(v.id) ? 'KEEP' : 'DROP'}  ${v.title}`)

    return videos.filter((v) => keep.has(v.id))
  } catch (err) {
    console.warn(`[Gemini] could not filter "${term}": ${err.message} - keeping rule-based result`)
    return videos
  }
}
