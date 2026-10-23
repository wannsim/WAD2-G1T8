<script setup>
import { ref, watch, onMounted } from 'vue'
import axios from 'axios'
import { API_URL } from '@/utils/config'
import { currentUser } from '@/utils/auth'
import { savedIds } from '@/utils/favourites'

// Owner: Jessie - the home page with For You / Following (Trending to be added later) tabs
const TABS = [
  { key: 'foryou', label: 'For you' },
  { key: 'following', label: 'Following' },
]
const tab = ref('foryou')
const items = ref([]) // [{ product, reason, score }] in ranking order (fixed until the feed loads again)
const loading = ref(false)
const newPicksReady = ref(false) // scores changed enough that a refresh would re-rank the feed

async function loadFeed() {
  loading.value = true
  newPicksReady.value = false
  const userId = currentUser.value ? currentUser.value._id : 'guest'
  try {
    const response = await axios.get(`${API_URL}/feed/${userId}`, { params: { tab: tab.value } })
    items.value = response.data
    logImpressions()
  } catch (error) {
    console.log(error.message)
    items.value = []
  } finally {
    loading.value = false
  }
}

// log one "impression" per product shown (logged-in buyers only)
function logImpressions() {
  if (!currentUser.value) return
  items.value.forEach((item) => {
    axios
      .post(`${API_URL}/feed/interactions`, {
        user: currentUser.value._id,
        product: item.product._id,
        shop: item.product.shop?._id,
        type: 'impression',
      })
      .catch(() => {})
  })
}

// clicking a card = a "click" signal (the detail page separately logs a "view")
function logClick(item) {
  if (!currentUser.value) return
  axios
    .post(`${API_URL}/feed/interactions`, {
      user: currentUser.value._id,
      product: item.product._id,
      shop: item.product.shop?._id,
      type: 'click',
    })
    .catch(() => {})
}

// As the buyer interacts (♥ / un-♥), the algorithm re-scores the cards on screen and we note the new
// scores + reasons here, but the cards keep their places: the ranking only changes when the feed
// loads again (Refresh button, or coming back to this page).
let scoreTimer = null
async function refreshScores() {
  if (!currentUser.value || tab.value !== 'foryou' || items.value.length === 0) return
  try {
    const ids = items.value.map((item) => item.product._id).join(',')
    const response = await axios.get(`${API_URL}/feed/${currentUser.value._id}/scores`, { params: { ids } })
    items.value.forEach((item) => {
      const fresh = response.data[item.product._id]
      if (!fresh) return
      item.score = fresh.score
      item.reason = fresh.reason
    })
    // would sorting by the new scores change the order? -> tell the buyer new picks are ready
    newPicksReady.value = items.value.some((item, i) => i > 0 && item.score > items.value[i - 1].score + 1e-9)
  } catch (error) {
    console.log(error.message)
  }
}
watch(savedIds, () => {
  clearTimeout(scoreTimer)
  scoreTimer = setTimeout(refreshScores, 300) // several quick ♥ clicks = one request
}, { deep: true })

// gold / silver / bronze for the top 3 of For you (Following is newest-first, so no ranks there)
const rankOf = (index) => (tab.value === 'foryou' && index < 3 ? index + 1 : 0)

onMounted(loadFeed)
watch(tab, loadFeed)
</script>

<template>
  <div>
    <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
      <ul class="nav nav-pills">
        <li v-for="t in TABS" :key="t.key" class="nav-item">
          <button class="nav-link" :class="{ active: tab === t.key }" @click="tab = t.key">{{ t.label }}</button>
        </li>
      </ul>

      <div class="d-flex align-items-center gap-2">
        <span v-if="newPicksReady" class="small new-picks">Your picks have changed</span>
        <button type="button" class="btn refresh-btn" :class="{ ready: newPicksReady }" :disabled="loading"
          aria-label="Refresh recommendations" @click="loadFeed">
          <svg :class="{ spinning: loading }" width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
            <path fill-rule="evenodd" d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2z" />
            <path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466" />
          </svg>
          {{ loading ? 'Refreshing...' : 'Refresh' }}
        </button>
      </div>
    </div>

    <p v-if="tab === 'foryou' && !currentUser" class="text-muted">Log in to get recommendations that match your interests.</p>
    <p v-if="tab === 'following' && !currentUser" class="text-muted">Log in and follow shops to see them here.</p>

    <p v-if="loading && items.length === 0" class="text-muted">Loading...</p>
    <p v-else-if="!loading && items.length === 0" class="text-muted">Nothing here yet.</p>

    <div class="card-grid" :class="{ refreshing: loading && items.length > 0 }">
      <div v-for="(item, index) in items" :key="item.product._id" class="feed-cell" :class="rankOf(index) ? `rank rank-${rankOf(index)}` : ''">
        <span v-if="rankOf(index)" class="rank-badge" :aria-label="`Ranked number ${rankOf(index)} for you`">{{ rankOf(index) }}</span>
        <ProductCard :product="item.product" :reason="item.reason" favourite @open="logClick(item)" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.refresh-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.45rem 1rem;
  border: 1px solid #ece6dc;
  border-radius: 999px;
  background: #fff;
  font-weight: 500;
  color: #2b2b2b;
}
.refresh-btn:hover:not(:disabled) {
  border-color: var(--brand);
  color: var(--brand);
}
/* scores changed: the button invites a refresh */
.refresh-btn.ready {
  border-color: var(--brand);
  background: var(--brand);
  color: #fff;
  animation: nudge 1.6s ease-in-out infinite;
}
@keyframes nudge {
  0%, 100% { box-shadow: 0 0 0 0 rgba(194, 65, 12, 0.35); }
  50% { box-shadow: 0 0 0 6px rgba(194, 65, 12, 0); }
}
.new-picks {
  color: var(--brand-dark);
}
.spinning {
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to { transform: rotate(360deg); }
}
.refreshing {
  opacity: 0.55;
  transition: opacity 0.2s ease;
}

/* top 3: coloured border + number badge */
.feed-cell {
  position: relative;
}
.rank :deep(.product-card) {
  border-width: 3px;
  border-color: var(--rank-colour);
  box-shadow: 0 6px 18px var(--rank-glow);
}
.rank-1 { --rank-colour: #d4a017; --rank-glow: rgba(212, 160, 23, 0.3); }
.rank-2 { --rank-colour: #a8acb3; --rank-glow: rgba(168, 172, 179, 0.35); }
.rank-3 { --rank-colour: #c27c3e; --rank-glow: rgba(194, 124, 62, 0.3); }
.rank-badge {
  position: absolute;
  top: -10px;
  left: -10px;
  z-index: 3;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border: 3px solid #fff;
  border-radius: 50%;
  background: var(--rank-colour);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25);
  font-weight: 800;
  color: #fff;
  text-shadow: 0 1px 1px rgba(0, 0, 0, 0.25);
}
@media (prefers-reduced-motion: reduce) {
  .refresh-btn.ready,
  .spinning {
    animation: none;
  }
}
</style>
