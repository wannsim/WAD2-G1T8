<script setup>
// Owner: Wan Sim
// "What to make next" panel on the seller Analytics page. Home sellers don't know what to make next, so they
// guess - this suggests up to 3 of their categories, each with the reason in plain words.
// Props only (MakeNextSection.vue loads the server data). The scoring is in utils/makeNext.js (tested).
import { computed } from 'vue'
import { MIN_RECENT_ORDERS, OWN_WEIGHT, PERIOD_WEEKS, suggestNext, TREND_WEIGHT } from '@/utils/makeNext'

const props = defineProps({
  orders: { type: Array, default: () => [] }, // every order of the shop (only completed ones count)
  categoryOf: { type: Object, default: () => ({}) }, // { productId: category } for this shop's products
  trends: { type: Array, default: () => [] }, // [{ category, term, growth }] rising keywords
  trendsAvailable: { type: Boolean, default: false }, // false = no trend data (no YouTube key / not refreshed yet)
  status: { type: String, default: 'ready' }, // 'loading' | 'ready' | 'error'
})

const suggestions = computed(() => suggestNext(props.orders, props.categoryOf, props.trendsAvailable ? props.trends : []))
const percent = (value) => `${value > 0 ? '+' : ''}${Math.round(value * 100)}%`
</script>

<template>
  <section class="make-next-panel p-3 p-md-4" aria-labelledby="make-next-title" :aria-busy="status === 'loading'">
    <div class="d-flex align-items-center flex-wrap gap-2 mb-1">
      <h2 id="make-next-title" class="h5 mb-0">What to make next</h2>
      <span class="badge suggestion-badge">Suggestion</span>
    </div>
    <p class="text-muted small mb-3">
      Ideas from your own orders (the last {{ PERIOD_WEEKS }} full weeks compared with the {{ PERIOD_WEEKS }} before)
      and what is trending online.
    </p>

    <p v-if="status === 'loading'" class="text-muted small mb-0" role="status">Loading suggestions…</p>
    <p v-else-if="status === 'error'" class="text-muted small mb-0" role="alert">Could not load suggestions right now. Please refresh to try again.</p>
    <template v-else>
      <p v-if="!trendsAvailable" class="note small mb-3" role="status">
        Trend data is not available right now (there is no YouTube trend data yet), so these suggestions use your own orders only.
      </p>

      <p v-if="!suggestions.length" class="empty-box small mb-0" role="status">
        No suggestions yet: none of your categories grew in the last {{ PERIOD_WEEKS }} weeks{{ trendsAvailable ? ', and nothing in them is trending' : '' }}.
      </p>
      <ol v-else class="list-unstyled mb-0">
        <li v-for="(s, i) in suggestions" :key="s.category" class="idea">
          <span class="rank" aria-hidden="true">{{ i + 1 }}</span>
          <div class="idea-body">
            <div class="d-flex justify-content-between align-items-baseline flex-wrap gap-2">
              <h3 class="h6 mb-0">{{ s.category }}</h3>
              <span class="score small">Score {{ Math.round(s.score * 100) }} / 100</span>
            </div>
            <p class="small mb-1">{{ s.reason }}</p>
            <template v-if="s.ideas.length">
              <p class="ideas-label small mb-1" :id="`ideas-${i}`">Ideas to explore (trending on YouTube)</p>
              <ul class="list-unstyled d-flex flex-wrap gap-1 mb-0" :aria-labelledby="`ideas-${i}`">
                <li v-for="idea in s.ideas" :key="idea.term" class="idea-chip small">{{ idea.term }} {{ percent(idea.growth) }}</li>
              </ul>
            </template>
          </div>
        </li>
      </ol>
    </template>

    <details class="mt-3">
      <summary class="data-toggle">How is this ranked?</summary>
      <div class="small text-muted mt-2">
        <p class="mb-2">
          Each of your categories gets two scores from 0 to 1. Own growth: your completed orders in the last
          {{ PERIOD_WEEKS }} full weeks compared with the {{ PERIOD_WEEKS }} weeks before (+100% or more counts as 1;
          a category needs at least {{ MIN_RECENT_ORDERS }} recent orders, and one with no orders before but some now
          counts as 1). Trend: how much the best rising YouTube keyword in that category grew this week (+100% or more counts as 1).
        </p>
        <p class="mb-0">
          Score = {{ OWN_WEIGHT }} × own growth + {{ TREND_WEIGHT }} × trend. Your own orders count more because they
          come from your real buyers; a trend is general interest in Singapore. A suggestion is a hint, not a promise
          that it will sell.
        </p>
      </div>
    </details>
  </section>
</template>

<style scoped>
.make-next-panel { background: var(--surface); border: 1px solid var(--line); border-radius: 1rem; box-shadow: 0 4px 16px rgb(0 0 0 / 3%); }
.suggestion-badge { background: var(--aqua-soft); color: var(--aqua-dark); font-weight: 600; }
.note { padding: 0.6rem 0.75rem; border-radius: 0.75rem; background: var(--surface-soft); color: var(--ink-soft); }
.empty-box { padding: 1rem; border-radius: 0.75rem; background: var(--surface-soft); color: var(--ink-soft); }
.idea { display: flex; gap: 0.75rem; padding: 0.75rem 0; border-top: 1px solid var(--line); }
.idea:first-child { border-top: 0; padding-top: 0; }
.rank { display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; width: 28px; height: 28px; border-radius: 50%; background: var(--ocean-soft); color: var(--ocean-dark); font-weight: 700; font-size: 0.85rem; }
.idea-body { flex: 1; min-width: 0; overflow-wrap: anywhere; }
.score { color: var(--muted); white-space: nowrap; }
.ideas-label { color: var(--muted); }
.idea-chip { display: inline-block; padding: 0.15rem 0.6rem; border-radius: 0.6rem; /* not a full pill: it can wrap to 2 lines on phones */ background: var(--aqua-soft); color: var(--aqua-dark); }
.data-toggle { color: var(--brand-dark); }
</style>
