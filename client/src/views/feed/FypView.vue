<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import axios from 'axios'
import { API_URL } from '@/utils/config'
import { currentUser } from '@/utils/auth'
import { savedIds } from '@/utils/favourites'
import { formatPrice } from '@/utils/format'
import FavouriteButton from '@/components/FavouriteButton.vue'
import { CATEGORIES } from '@/utils/constants'

// Owner: Jessie - the home page with For You / Trending / Following tabs
// Layout (Cheyenne): BuyMore-style "bento" of pastel tiles on top of For you, then the rest of the feed.
const TABS = [
  { key: 'foryou', label: 'For you', icon: 'M7.657 6.247c.11-.33.576-.33.686 0l.645 1.937a2.89 2.89 0 0 0 1.829 1.828l1.936.645c.33.11.33.576 0 .686l-1.937.645a2.89 2.89 0 0 0-1.828 1.829l-.645 1.936a.361.361 0 0 1-.686 0l-.645-1.937a2.89 2.89 0 0 0-1.828-1.828l-1.937-.645a.361.361 0 0 1 0-.686l1.937-.645a2.89 2.89 0 0 0 1.828-1.828zM3.794 1.148a.217.217 0 0 1 .412 0l.387 1.162c.173.518.579.924 1.097 1.097l1.162.387a.217.217 0 0 1 0 .412l-1.162.387A1.73 1.73 0 0 0 4.593 5.69l-.387 1.162a.217.217 0 0 1-.412 0L3.407 5.69A1.73 1.73 0 0 0 2.31 4.593l-1.162-.387a.217.217 0 0 1 0-.412l1.162-.387A1.73 1.73 0 0 0 3.407 2.31zM10.863.099a.145.145 0 0 1 .274 0l.258.774c.115.346.386.617.732.732l.774.258a.145.145 0 0 1 0 .274l-.774.258a1.16 1.16 0 0 0-.732.732l-.258.774a.145.145 0 0 1-.274 0l-.258-.774a1.16 1.16 0 0 0-.732-.732L9.1 2.137a.145.145 0 0 1 0-.274l.774-.258c.346-.115.617-.386.732-.732z' },
  { key: 'trending', label: 'Trending', icon: 'M8 16c3.314 0 6-2 6-5.5 0-1.5-.5-4-2.5-6 .25 1.5-1.25 2-1.25 2C11 4 9 .5 6 0c.357 2 .5 4-2 6-1.25 1-2 2.729-2 4.5C2 14 4.686 16 8 16m0-1c-1.657 0-3-1-3-2.75 0-.75.25-2 1.25-3C6.125 10 7 10.5 7 10.5c-.375-1.25.5-3.25 2-3.5-.179 1-.25 2 1 3 .625.5 1 1.364 1 2.25C11 14 9.657 15 8 15' },
  { key: 'following', label: 'Following', icon: 'M15 14s1 0 1-1-1-4-5-4-5 3-5 4 1 1 1 1zm-7.978-1L7 12.996c.001-.264.167-1.03.76-1.72C8.312 10.629 9.282 10 11 10c1.717 0 2.687.63 3.24 1.276.593.69.758 1.457.76 1.72l-.008.002-.014.002zM11 7a2 2 0 1 0 0-4 2 2 0 0 0 0 4m3-2a3 3 0 1 1-6 0 3 3 0 0 1 6 0M6.936 9.28a6 6 0 0 0-1.23-.247A7 7 0 0 0 5 9c-4 0-5 3-5 4q0 1 1 1h4.216A2.24 2.24 0 0 1 5 13c0-1.01.377-2.042 1.09-2.904.243-.294.526-.569.846-.816M4.92 10A5.5 5.5 0 0 0 4 13H1c0-.26.164-1.03.76-1.724.545-.636 1.492-1.256 3.16-1.275ZM1.5 5.5a3 3 0 1 1 6 0 3 3 0 0 1-6 0m3-2a2 2 0 1 0 0 4 2 2 0 0 0 0-4' },
]
const route = useRoute()
const tab = ref(TABS.some((t) => t.key === route.query.tab) ? route.query.tab : 'foryou') // /home?tab=following from the top bar
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

// gold / silver / bronze for the top 3 of For you and Trending (Following is newest-first, so no ranks there)
const rankOf = (index) => (tab.value !== 'following' && index < 3 ? index + 1 : 0)

// ---------- the bento tiles on top of For you ----------
// For you: the top 2 picks get big tiles (ranks 1 and 2), the grid below starts at rank 3
const showBento = computed(() => tab.value === 'foryou' && items.value.length >= 2)
const picks = computed(() => (showBento.value ? items.value.slice(0, 2) : []))
const gridItems = computed(() => (showBento.value ? items.value.slice(2) : items.value))
const gridOffset = computed(() => (showBento.value ? 2 : 0))

const hot = ref([])        // this week's trending products (pictures for the banners)
const favourites = ref([]) // the buyer's saved products (Favourites tile)
const followed = ref([])   // shops the buyer follows
const favIndex = ref(0)
const hotImage = (i) => {
  const list = hot.value.length ? hot.value : items.value
  return list.length ? list[i % list.length].product.imageUrl : '/placeholder.svg'
}
const photoPick = computed(() => (hot.value.length > 3 ? hot.value[3] : hot.value[0] || items.value[2] || null))
const favShown = computed(() => [0, 1].map((k) => favourites.value[(favIndex.value + k) % Math.max(favourites.value.length, 1)]).filter(Boolean))
function moveFav(step) {
  const n = favourites.value.length
  if (n > 1) favIndex.value = (favIndex.value + step + n) % n
}

async function loadBento() {
  const userId = currentUser.value ? currentUser.value._id : 'guest'
  const requests = [axios.get(`${API_URL}/feed/${userId}`, { params: { tab: 'trending' } })]
  if (currentUser.value) {
    requests.push(axios.get(`${API_URL}/favourites/${userId}`), axios.get(`${API_URL}/shops/following/${userId}`))
  }
  const [trending, favs, follows] = await Promise.allSettled(requests)
  hot.value = trending.status === 'fulfilled' ? trending.value.data.slice(0, 6) : []
  favourites.value = favs?.status === 'fulfilled' ? favs.value.data.map((f) => f.product).filter(Boolean) : []
  followed.value = follows?.status === 'fulfilled' ? follows.value.data : []
}
watch(savedIds, () => {
  if (currentUser.value) axios.get(`${API_URL}/favourites/${currentUser.value._id}`)
    .then((r) => (favourites.value = r.data.map((f) => f.product).filter(Boolean))).catch(() => {})
}, { deep: true })

// ---------- "More for you" as one swipeable row per category (like Shopee's Best sellers / New rows) ----------
const CATEGORY_EMOJI = { 'Baked goods': '🥐', Meals: '🍛', 'Snacks & desserts': '🍡', Drinks: '🧋', 'Handmade crafts': '🧶', Others: '✨' }
// rows keep the feed's order inside, and the row with the best-ranked product comes first
const categoryRows = computed(() => {
  const rows = new Map()
  gridItems.value.forEach((item, i) => {
    const name = CATEGORIES.includes(item.product.category) ? item.product.category : 'Others'
    if (!rows.has(name)) rows.set(name, { name, emoji: CATEGORY_EMOJI[name], items: [] })
    rows.get(name).items.push({ ...item, rank: rankOf(i + gridOffset.value) })
  })
  return [...rows.values()]
})
const useRows = computed(() => showBento.value && categoryRows.value.length > 0)

// ‹ › buttons: scroll the row by most of its width
const rowRefs = {}
const rowEnds = ref({}) // row name -> { start, end } so the arrows can grey out at either end
function updateEnds(name) {
  const el = rowRefs[name]
  if (!el) return
  const start = el.scrollLeft <= 2
  const end = el.scrollLeft + el.clientWidth >= el.scrollWidth - 2
  const old = rowEnds.value[name]
  if (old && old.start === start && old.end === end) return // nothing changed: don't re-render (that would loop)
  rowEnds.value = { ...rowEnds.value, [name]: { start, end } }
}
// Vue calls this on every render; only a NEW row element needs its arrows worked out
function setRowRef(name, el) {
  if (!el || rowRefs[name] === el) return
  rowRefs[name] = el
  requestAnimationFrame(() => updateEnds(name))
}
function scrollRow(name, direction) {
  const el = rowRefs[name]
  if (el) el.scrollBy({ left: direction * el.clientWidth * 0.8, behavior: 'smooth' })
}

function useFallbackImage(event) {
  if (!event.target.src.endsWith('/placeholder.svg')) event.target.src = '/placeholder.svg'
}

onMounted(() => {
  loadFeed()
  loadBento()
})
watch(tab, loadFeed)
watch(categoryRows, () => requestAnimationFrame(() => Object.keys(rowRefs).forEach(updateEnds)))
const onResize = () => Object.keys(rowRefs).forEach(updateEnds)
onMounted(() => window.addEventListener('resize', onResize))
onUnmounted(() => window.removeEventListener('resize', onResize))
</script>

<template>
  <div>
    <!-- title, tabs, refresh + search (like "Explore | All Men Women | Filters 🔍") -->
    <div class="feed-head">
      <h2 class="page-title mb-0">{{ tab === 'trending' ? 'Trending' : tab === 'following' ? 'Following' : 'For you' }}</h2>
      <ul class="nav nav-pills feed-tabs">
        <li v-for="t in TABS" :key="t.key" class="nav-item">
          <button class="nav-link" :class="{ active: tab === t.key }" @click="tab = t.key">
            <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path :d="t.icon" /></svg>
            {{ t.label }}
          </button>
        </li>
      </ul>
      <div class="head-actions">
        <span v-if="newPicksReady" class="small new-picks">Your picks have changed</span>
        <button type="button" class="btn refresh-btn" :class="{ ready: newPicksReady }" :disabled="loading"
          aria-label="Refresh recommendations" @click="loadFeed">
          <svg :class="{ spinning: loading }" width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
            <path fill-rule="evenodd" d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2z" />
            <path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466" />
          </svg>
          {{ loading ? 'Refreshing...' : 'Refresh' }}
        </button>
        <RouterLink to="/browse" class="search-circle" aria-label="Search products">
          <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
            <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001q.044.06.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1 1 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0" />
          </svg>
        </RouterLink>
      </div>
    </div>

    <p v-if="tab === 'foryou' && !currentUser" class="text-muted">Log in to get recommendations that match your interests.</p>
    <p v-if="tab === 'following' && !currentUser" class="text-muted">Log in and follow shops to see them here.</p>
    <p v-if="tab === 'trending'" class="small text-muted trending-note">
      <span aria-hidden="true">🔥</span> Most popular on Homly Hauls this week (orders, saves and views), boosted by
      what people are watching on YouTube right now.
    </p>

    <!-- ===== bento tiles (For you only) ===== -->
    <section v-if="showBento" class="bento" :class="{ refreshing: loading }">
      <!-- mint banner: trending -->
      <button type="button" class="tile tile-mint area-hot" @click="tab = 'trending'">
        <img :src="hotImage(0)" alt="" class="banner-img left" @error="useFallbackImage" />
        <span class="banner-text">
          <span class="banner-title">What's hot this week</span>
          <span class="banner-btn">See trending</span>
        </span>
        <img :src="hotImage(1)" alt="" class="banner-img right" @error="useFallbackImage" />
      </button>

      <!-- butter banner: near you -->
      <RouterLink to="/map" class="tile tile-butter area-near">
        <span>
          <span class="tile-heading">Homemade, near you</span>
          <span class="tile-sub">Find sellers by MRT station</span>
        </span>
        <img :src="hotImage(2)" alt="" class="side-img" @error="useFallbackImage" />
        <span class="arrow-chip" aria-hidden="true">↗</span>
      </RouterLink>

      <!-- photo tile: popular right now -->
      <div v-if="photoPick" class="tile tile-grey area-photo">
        <img :src="photoPick.product.imageUrl" alt="" class="photo-fill" @error="useFallbackImage" />
        <FavouriteButton v-if="currentUser" :product-id="photoPick.product._id" class="tile-heart" />
        <RouterLink :to="`/products/${photoPick.product._id}`" class="frost-btn tile-link">{{ photoPick.product.name }}</RouterLink>
      </div>

      <!-- favourites mini carousel -->
      <div class="tile tile-outline area-favs">
        <div class="fav-head">
          <span>Favourites</span>
          <span class="d-flex gap-1">
            <button type="button" class="fav-arrow" aria-label="Previous favourites" :disabled="favourites.length < 2" @click="moveFav(-1)">&lsaquo;</button>
            <button type="button" class="fav-arrow" aria-label="Next favourites" :disabled="favourites.length < 2" @click="moveFav(1)">&rsaquo;</button>
          </span>
        </div>
        <div v-if="favShown.length" class="fav-thumbs">
          <RouterLink v-for="p in favShown" :key="p._id" :to="`/products/${p._id}`" class="fav-thumb" :title="p.name">
            <img :src="p.imageUrl" :alt="p.name" @error="useFallbackImage" />
          </RouterLink>
        </div>
        <p v-else class="fav-empty">{{ currentUser ? 'Tap ♥ on anything you like to keep it here.' : 'Log in to save your favourites.' }}</p>
        <RouterLink :to="currentUser ? '/favourites' : '/login'" class="see-all-btn">{{ currentUser ? 'See all' : 'Log in' }}</RouterLink>
      </div>

      <!-- the top 2 picks: tall product tiles with a price pill -->
      <div v-for="(item, i) in picks" :key="item.product._id" class="tile tile-grey pick-tile" :class="[`area-pick${i + 1}`, `rank rank-${i + 1}`]">
        <span class="rank-badge" :aria-label="`Ranked number ${i + 1} for you`">{{ i + 1 }}</span>
        <FavouriteButton :product-id="item.product._id" class="tile-heart" />
        <img :src="item.product.imageUrl" alt="" class="pick-img" @error="useFallbackImage" />
        <div class="pick-info">
          <span class="pick-label">{{ i === 0 ? 'Top pick' : 'Your choice' }}</span>
          <RouterLink :to="`/products/${item.product._id}`" class="pick-name tile-link clamp-2" @click="logClick(item)">{{ item.product.name }}</RouterLink>
          <div class="pick-bottom">
            <span class="pick-reason clamp-2" :title="item.reason">{{ item.reason }}</span>
            <span class="price-pill">{{ formatPrice(item.product.price) }}</span>
          </div>
        </div>
      </div>

      <!-- ice banner: followed shops -->
      <button type="button" class="tile tile-ice area-follow" @click="currentUser ? (tab = 'following') : $router.push('/login')">
        <span>
          <span class="tile-heading">{{ followed.length ? 'Shops you follow' : 'Follow your favourite shops' }}</span>
          <span class="tile-sub">{{ followed.length ? `${followed.length} ${followed.length === 1 ? 'shop' : 'shops'} · see what is new` : 'Their new listings show up here' }}</span>
        </span>
        <span v-if="followed.length" class="big-stack" aria-hidden="true">
          <span v-for="shop in followed.slice(0, 3)" :key="shop._id">{{ shop.name.charAt(0).toUpperCase() }}</span>
        </span>
        <span class="arrow-chip" aria-hidden="true">↗</span>
      </button>
    </section>

    <!-- For you: one row per category, swipe (or use ‹ ›) to see more -->
    <template v-if="useRows">
      <h3 class="section-title">More for you</h3>
      <section v-for="row in categoryRows" :key="row.name" class="cat-row" :class="{ refreshing: loading }" :aria-label="row.name">
        <div class="cat-head">
          <h4 class="ribbon">{{ row.name }} <span aria-hidden="true">{{ row.emoji }}</span></h4>
          <span class="small text-muted d-none d-sm-inline">{{ row.items.length }} {{ row.items.length === 1 ? 'pick' : 'picks' }}</span>
          <div class="cat-actions">
            <RouterLink :to="{ path: '/browse', query: { category: row.name } }" class="see-all-link">See all</RouterLink>
            <button type="button" class="row-arrow" :disabled="rowEnds[row.name]?.start !== false" :aria-label="`Scroll ${row.name} left`" @click="scrollRow(row.name, -1)">&lsaquo;</button>
            <button type="button" class="row-arrow" :disabled="rowEnds[row.name]?.end !== false" :aria-label="`Scroll ${row.name} right`" @click="scrollRow(row.name, 1)">&rsaquo;</button>
          </div>
        </div>
        <div :ref="(el) => setRowRef(row.name, el)" class="cat-strip" @scroll.passive="updateEnds(row.name)">
          <div v-for="item in row.items" :key="item.product._id" class="feed-cell strip-cell" :class="item.rank ? `rank rank-${item.rank}` : ''">
            <span v-if="item.rank" class="rank-badge" :aria-label="`Ranked number ${item.rank} for you`">{{ item.rank }}</span>
            <ProductCard :product="item.product" :reason="item.reason" favourite no-swipe @open="logClick(item)" />
          </div>
        </div>
      </section>
    </template>

    <p v-if="loading && items.length === 0" class="text-muted">Loading...</p>
    <p v-else-if="!loading && items.length === 0" class="text-muted">Nothing here yet.</p>

    <div v-if="!useRows" class="card-grid" :class="{ refreshing: loading && items.length > 0 }">
      <div v-for="(item, index) in gridItems" :key="item.product._id" class="feed-cell" :class="rankOf(index + gridOffset) ? `rank rank-${rankOf(index + gridOffset)}` : ''">
        <span v-if="rankOf(index + gridOffset)" class="rank-badge" :aria-label="tab === 'trending' ? `Number ${rankOf(index + gridOffset)} trending` : `Ranked number ${rankOf(index + gridOffset)} for you`">{{ rankOf(index + gridOffset) }}</span>
        <ProductCard :product="item.product" :reason="item.reason" favourite @open="logClick(item)" />
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ---------- header ---------- */
.feed-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 1rem 2rem;
  margin-bottom: 1.25rem;
}
.feed-tabs {
  margin-top: 10px; /* balances the room kept for the blue bar under the active tab */
}
.head-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-left: auto;
}
.refresh-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  height: 46px;
  padding: 0 1.3rem;
  border: 0;
  border-radius: 1.1rem;
  background: var(--tile);
  font-weight: 500;
  color: var(--ink);
}
.refresh-btn:hover:not(:disabled) {
  background: var(--tile-hover);
  color: var(--navy);
}
/* scores changed: the button invites a refresh */
.refresh-btn.ready {
  background: var(--brand);
  color: #fff;
  animation: nudge 1.6s ease-in-out infinite;
}
@keyframes nudge {
  0%, 100% { box-shadow: 0 0 0 0 rgba(var(--brand-rgb), 0.35); }
  50% { box-shadow: 0 0 0 6px rgba(var(--brand-rgb), 0); }
}
.search-circle {
  display: inline-grid;
  place-items: center;
  width: 46px;
  height: 46px;
  border-radius: 50%;
  background: var(--tile);
  color: var(--ink);
}
.search-circle:hover {
  background: var(--tile-hover);
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
.section-title {
  margin: 2rem 0 1rem;
  font-size: 1.35rem;
  font-weight: 600;
}

/* ---------- bento grid ---------- */
.bento {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  grid-template-rows: 150px 170px 250px;
  grid-template-areas:
    'hot hot pick1 pick2'
    'near near pick1 pick2'
    'photo favs follow follow';
  gap: 1rem;
}
.area-hot { grid-area: hot; }
.area-near { grid-area: near; }
.area-photo { grid-area: photo; }
.area-favs { grid-area: favs; }
.area-pick1 { grid-area: pick1; }
.area-pick2 { grid-area: pick2; }
.area-follow { grid-area: follow; }

.tile {
  position: relative;
  min-width: 0;
  overflow: hidden;
  border: 0;
  border-radius: 1.75rem;
  color: var(--navy);
  text-align: left;
  text-decoration: none;
  transition: transform 0.18s ease, box-shadow 0.18s ease;
}
button.tile,
a.tile,
.pick-tile,
.area-photo {
  cursor: pointer;
}
button.tile:hover,
a.tile:hover,
.pick-tile:hover,
.area-photo:hover {
  transform: translateY(-3px);
  box-shadow: 0 14px 30px rgba(var(--navy-rgb), 0.12);
}
.tile-mint { background: var(--mint); }
.tile-butter { background: var(--butter); }
.tile-grey { background: var(--tile); }
.tile-ice { background: var(--ice); }
.tile-outline {
  border: 1px solid var(--line);
  background: var(--surface);
}
/* whole tile clickable: the link inside stretches over it */
.tile-link::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 1;
}
.tile-heart {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 2;
}

/* mint banner */
.area-hot {
  display: flex;
  align-items: center;
  justify-content: center;
}
.banner-img {
  position: absolute;
  bottom: -18px;
  width: 26%;
  max-width: 130px;
  aspect-ratio: 1;
  border-radius: 1.5rem;
  object-fit: cover;
  box-shadow: 0 10px 24px rgba(var(--navy-rgb), 0.18);
}
.banner-img.left { left: -8px; transform: rotate(-8deg); }
.banner-img.right { right: -8px; transform: rotate(8deg); }
.banner-text {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.6rem;
}
.banner-title {
  max-width: 48%;
  font-size: clamp(1rem, 1.6vw, 1.4rem);
  line-height: 1.15;
  text-align: center;
  font-weight: 700;
  letter-spacing: 0.01em;
  text-transform: uppercase;
}
.banner-btn,
.frost-btn,
.see-all-btn {
  display: inline-block;
  padding: 0.55rem 1.4rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.65);
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--navy);
  text-decoration: none;
  backdrop-filter: blur(6px);
}

/* butter + ice banners */
.area-near,
.area-follow {
  display: flex;
  align-items: center;
  padding: 0 2rem;
}
.area-near > span:first-child,
.area-follow > span:first-child {
  position: relative;
  z-index: 1;
  max-width: 58%;
}
.tile-heading {
  display: block;
  font-size: clamp(1.15rem, 1.7vw, 1.6rem);
  font-weight: 600;
  line-height: 1.15;
}
.tile-sub {
  display: block;
  margin-top: 0.35rem;
  font-size: 0.95rem;
  color: var(--ink-soft);
}
.side-img {
  position: absolute;
  right: 56px;
  bottom: -10px;
  width: 34%;
  max-width: 150px;
  aspect-ratio: 1;
  border-radius: 1.5rem;
  object-fit: cover;
  transform: rotate(6deg);
  box-shadow: 0 10px 24px rgba(var(--navy-rgb), 0.18);
}
.arrow-chip {
  position: absolute;
  top: 14px;
  right: 14px;
  display: inline-grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--surface);
  font-size: 0.95rem;
  color: var(--navy);
}
.big-stack {
  display: inline-flex;
  margin-left: auto;
  margin-right: 2.5rem;
}
.big-stack span {
  display: inline-grid;
  place-items: center;
  width: 58px;
  height: 58px;
  margin-left: -16px;
  border: 4px solid var(--ice);
  border-radius: 50%;
  background: linear-gradient(135deg, var(--ocean), var(--aqua));
  font-size: 1.4rem;
  font-weight: 700;
  color: #fff;
}

/* photo tile */
.photo-fill {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.area-photo .frost-btn {
  position: absolute;
  left: 50%;
  bottom: 16px;
  max-width: calc(100% - 2rem);
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  transform: translateX(-50%);
}

/* favourites */
.area-favs {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  padding: 0.75rem;
}
.fav-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.55rem 0.55rem 0.55rem 1rem;
  border-radius: 1.2rem;
  background: var(--peach);
  font-weight: 500;
}
.fav-arrow {
  width: 28px;
  height: 28px;
  border: 0;
  border-radius: 50%;
  background: transparent;
  font-size: 1.3rem;
  line-height: 1;
  color: var(--navy);
}
.fav-arrow:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.7);
}
.fav-arrow:disabled {
  opacity: 0.35;
}
.fav-thumbs {
  flex: 1;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
  min-height: 0;
  padding: 0.5rem;
  border-radius: 1.2rem;
  background: var(--peach);
}
.fav-thumb {
  min-height: 0;
  overflow: hidden;
  border-radius: 0.9rem;
}
.fav-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.2s ease;
}
.fav-thumb:hover img {
  transform: scale(1.05);
}
.fav-empty {
  flex: 1;
  display: grid;
  place-items: center;
  margin: 0;
  padding: 0 0.75rem;
  border-radius: 1.2rem;
  background: var(--peach);
  font-size: 0.85rem;
  text-align: center;
  color: var(--ink-soft);
}
.area-favs .see-all-btn {
  position: absolute;
  right: 1.4rem;
  bottom: 1.25rem;
  background: var(--surface);
  box-shadow: 0 4px 12px rgba(var(--navy-rgb), 0.1);
}

/* the 2 big pick tiles */
.pick-tile {
  display: flex;
  flex-direction: column;
}
.pick-img {
  flex: 1;
  min-height: 0;
  width: 100%;
  object-fit: cover;
}
.pick-info {
  padding: 0.9rem 1rem 1rem;
}
.pick-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-top: 0.5rem;
}
.min-w-0 { min-width: 0; }
.pick-label {
  display: block;
  font-size: 0.75rem;
  color: var(--muted);
}
.pick-name {
  display: -webkit-box;
  min-height: 0;
  font-size: 1.05rem;
  font-weight: 600;
  line-height: 1.25;
  color: var(--navy);
  text-decoration: none;
}
.pick-reason {
  display: -webkit-box;
  min-width: 0;
  min-height: 0;
  font-size: 0.75rem;
  color: var(--muted);
}
.price-pill {
  flex-shrink: 0;
  padding: 0.6rem 1.1rem;
  border-radius: 999px;
  background: var(--ocean);
  box-shadow: 0 8px 18px rgba(var(--ocean-rgb), 0.3);
  font-weight: 600;
  color: #fff;
}

/* ---------- category rows ---------- */
.cat-row {
  margin-bottom: 1.5rem;
  padding: 0 0 1rem;
  border: 1px solid var(--line);
  border-radius: 1.6rem;
  overflow: hidden;
}
.cat-head {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem 1rem 0.75rem 0;
}
/* ribbon label with a slanted end, like Shopee's "BEST SELLERS" */
.ribbon {
  margin: 0;
  padding: 0.5rem 1.6rem 0.5rem 1.1rem;
  background: var(--ocean);
  clip-path: polygon(0 0, 100% 0, calc(100% - 14px) 100%, 0 100%);
  font-size: 0.95rem;
  font-weight: 700;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  color: #fff;
  white-space: nowrap;
}
.cat-actions {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  margin-left: auto;
}
.see-all-link {
  margin-right: 0.35rem;
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--ocean-dark);
  text-decoration: none;
  white-space: nowrap;
}
.see-all-link:hover {
  text-decoration: underline;
}
.row-arrow {
  display: inline-grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border: 0;
  border-radius: 50%;
  background: var(--tile);
  font-size: 1.3rem;
  line-height: 1;
  color: var(--navy);
}
.row-arrow:hover:not(:disabled) {
  background: var(--tile-hover);
}
.row-arrow:disabled {
  opacity: 0.35;
}
.cat-strip {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: clamp(190px, 21%, 240px);
  gap: 1rem;
  padding: 12px 1rem 0.5rem; /* top room for the rank badge */
  overflow-x: auto;
  overscroll-behavior-x: contain;
  scroll-snap-type: x mandatory;
  scroll-padding-left: 1rem;
  scrollbar-width: thin;
}
.strip-cell {
  scroll-snap-align: start;
  min-width: 0;
}
.strip-cell :deep(.product-card) {
  height: 100%;
}
.strip-cell .rank-badge {
  top: -8px;
  left: -6px;
}

/* ---------- ranks (top 3): coloured border + number badge ---------- */
.feed-cell {
  position: relative;
}
.rank :deep(.product-card) {
  --bs-card-border-width: 3px; /* Bootstrap then shrinks the photo's corners to match: no gap */
  --bs-card-border-color: var(--rank-colour);
  box-shadow: 0 6px 18px var(--rank-glow);
}
.pick-tile.rank {
  overflow: visible;
  box-shadow: 0 0 0 3px var(--rank-colour), 0 6px 18px var(--rank-glow);
}
.pick-tile.rank .pick-img {
  border-radius: 1.75rem 1.75rem 0 0;
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

/* ---------- smaller screens ---------- */
@media (max-width: 1199.98px) {
  .bento {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    grid-template-rows: 150px 160px 360px 230px 150px;
    grid-template-areas:
      'hot hot'
      'near near'
      'pick1 pick2'
      'photo favs'
      'follow follow';
  }
  .head-actions {
    margin-left: 0;
  }
}
@media (max-width: 575.98px) {
  .cat-strip {
    grid-auto-columns: 46%; /* two cards and a peek of the next one */
    gap: 0.65rem;
  }
  .ribbon {
    font-size: 0.8rem;
  }
  .row-arrow {
    display: none; /* phones: just swipe */
  }
  /* tabs: one row you can swipe sideways */
  .feed-tabs {
    flex-wrap: nowrap;
    max-width: calc(100% + 1rem);
    margin-right: -1rem;
    overflow-x: auto;
    scrollbar-width: none;
  }
  .feed-tabs :deep(.nav-link) {
    padding: 0.55rem 1rem;
    white-space: nowrap;
  }
  .feed-head {
    gap: 0.75rem 1rem;
  }
  .bento {
    grid-template-rows: 150px 150px 300px 200px 140px;
    gap: 0.75rem;
  }
  .banner-img { width: 90px; height: 90px; }
  .banner-img.left { left: -14px; }
  .banner-img.right { right: -14px; }
  .banner-title { font-size: 1.1rem; }
  .area-near, .area-follow { padding: 0 1.25rem; }
  .tile-heading { font-size: 1.15rem; }
  .side-img { width: 100px; height: 100px; right: 20px; }
  .big-stack { margin-right: 1.5rem; }
  .big-stack span { width: 48px; height: 48px; font-size: 1.1rem; }
  .pick-info { padding: 0.75rem; }
  .pick-reason { display: none; }
  .pick-bottom { justify-content: flex-end; }
  .area-favs .see-all-btn { right: 1rem; bottom: 1rem; padding: 0.4rem 1rem; }
}
@media (prefers-reduced-motion: reduce) {
  .refresh-btn.ready,
  .spinning {
    animation: none;
  }
  .tile, .tile:hover { transition: none; transform: none; }
}
</style>
