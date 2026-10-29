<script setup>
import { computed, ref, watch } from 'vue'
import { shortNumber, timeAgo } from '@/utils/format'
import StarRating from './StarRating.vue'

// The look of every review list: star breakdown, total, average, then review cards with
// a rating filter, a sort and pages. ReviewList (shop) and ProductReviews (product page) load the
// reviews and pass them in.
//   <ReviewBoard :reviews="reviews" show-product />   show-product: name the product on each card
//   hide-breakdown: leave out the star bars (product page)
const props = defineProps({
  reviews: { type: Array, default: () => [] },
  showProduct: Boolean,
  hideBreakdown: Boolean,
})

const PAGE_SIZE = 6
const ratingFilter = ref('all') // 'all' | 5 | 4 | 3 | 2 | 1
const sort = ref('latest')      // 'latest' | 'oldest' | 'highest' | 'lowest'
const page = ref(1)

// ---- summary ----
const total = computed(() => props.reviews.length)
const average = computed(() => (total.value ? props.reviews.reduce((sum, r) => sum + r.rating, 0) / total.value : 0))
const breakdown = computed(() => [5, 4, 3, 2, 1].map((stars) => {
  const count = props.reviews.filter((r) => r.rating === stars).length
  return { stars, count, percent: total.value ? Math.round((count / total.value) * 100) : 0 }
}))
// width of each of the 5 average stars that is gold, e.g. 4.5 -> 100,100,100,100,50
const averageFill = computed(() => [1, 2, 3, 4, 5].map((n) => Math.round(Math.min(1, Math.max(0, average.value - n + 1)) * 100)))

// ---- list ----
const SORTS = {
  latest: (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
  oldest: (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
  highest: (a, b) => b.rating - a.rating || SORTS.latest(a, b),
  lowest: (a, b) => a.rating - b.rating || SORTS.latest(a, b),
}
const filtered = computed(() => props.reviews
  .filter((r) => ratingFilter.value === 'all' || r.rating === ratingFilter.value)
  .sort(SORTS[sort.value]))
const pageCount = computed(() => Math.max(1, Math.ceil(filtered.value.length / PAGE_SIZE)))
const visible = computed(() => filtered.value.slice((page.value - 1) * PAGE_SIZE, page.value * PAGE_SIZE))
watch([ratingFilter, sort, () => props.reviews], () => (page.value = 1)) // new filter / list starts on page 1

// "Robert Karmazov" -> "RK"
const initials = (review) => (review.buyer?.name || 'Buyer').split(/\s+/).slice(0, 2).map((w) => w.charAt(0).toUpperCase()).join('')
</script>

<template>
  <div class="review-board">
    <!-- ===== star breakdown ===== -->
    <ul v-if="!hideBreakdown" class="breakdown list-unstyled" aria-label="Ratings breakdown">
        <li v-for="row in breakdown" :key="row.stars">
          <span class="bar-label">{{ row.stars }} <span class="star" aria-hidden="true">★</span></span>
          <span class="bar" role="img" :aria-label="`${row.stars} stars: ${row.percent}%`">
            <span class="bar-fill" :style="{ width: `${row.percent}%` }"></span>
          </span>
          <span class="bar-percent">{{ row.percent }}%</span>
        </li>
    </ul>

    <!-- ===== heading with total + average, then cards ===== -->
    <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
      <div class="d-flex align-items-center flex-wrap gap-3">
        <h3 class="feedback-title mb-0">Customer Feedback</h3>
        <span class="stat-chip">
          <span class="stat-label">Total reviews</span>
          <span class="stat-number">{{ shortNumber(total) }}</span>
        </span>
        <span class="stat-chip">
          <span class="stat-label">Average rating</span>
          <span class="stat-number">{{ average.toFixed(1) }}</span>
          <span class="avg-stars" role="img" :aria-label="`${average.toFixed(1)} out of 5 stars`">
            <span v-for="(fill, i) in averageFill" :key="i" class="avg-star" aria-hidden="true">
              ★<span class="avg-star-fill" :style="{ width: `${fill}%` }">★</span>
            </span>
          </span>
        </span>
      </div>
      <div class="d-flex gap-2">
        <select v-model="ratingFilter" class="form-select form-select-sm filter-select" aria-label="Filter by rating">
          <option value="all">All Ratings</option>
          <option v-for="n in [5, 4, 3, 2, 1]" :key="n" :value="n">{{ n }} {{ n === 1 ? 'Star' : 'Stars' }}</option>
        </select>
        <select v-model="sort" class="form-select form-select-sm sort-select" aria-label="Sort reviews">
          <option value="latest">Latest Ratings</option>
          <option value="oldest">Oldest Ratings</option>
          <option value="highest">Highest Ratings</option>
          <option value="lowest">Lowest Ratings</option>
        </select>
      </div>
    </div>

    <p v-if="filtered.length === 0" class="text-muted">No reviews match this filter.</p>
    <div v-else class="cards">
      <article v-for="r in visible" :key="r._id" class="review-card">
        <div class="d-flex align-items-center gap-2 mb-2">
          <span class="initials" aria-hidden="true">{{ initials(r) }}</span>
          <strong class="reviewer">{{ r.buyer?.name || 'Buyer' }}</strong>
        </div>
        <span role="img" :aria-label="`${r.rating} out of 5 stars`"><StarRating :value="r.rating" /></span>
        <p v-if="r.comment?.trim()" class="comment">{{ r.comment }}</p>
        <p v-else class="comment fst-italic">No written comment.</p>
        <div class="card-foot">
          <span>{{ timeAgo(r.createdAt) }}</span>
          <template v-if="showProduct">
            <RouterLink v-if="r.product?._id" :to="`/products/${r.product._id}`" class="product-link">{{ r.product.name }}</RouterLink>
            <span v-else class="text-muted small">Product no longer available</span>
          </template>
        </div>
      </article>
    </div>

    <nav v-if="pageCount > 1" class="pager" aria-label="Review pages">
      <button type="button" class="pager-btn" :disabled="page === 1" aria-label="Previous page" @click="page--">‹</button>
      <button v-for="n in pageCount" :key="n" type="button" class="pager-btn" :class="{ active: n === page }"
        :aria-current="n === page ? 'page' : undefined" @click="page = n">{{ n }}</button>
      <button type="button" class="pager-btn" :disabled="page === pageCount" aria-label="Next page" @click="page++">›</button>
    </nav>
  </div>
</template>

<style scoped>
/* ---- star breakdown ---- */
.breakdown {
  width: 50%; /* about half the page; full width on phones (see the media query) */
  margin-bottom: 2rem;
}
.breakdown li {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.9rem;
}
.breakdown li:last-child {
  margin-bottom: 0;
}
.bar-label {
  width: 2.2rem;
  font-size: 1.05rem;
  color: var(--ink);
  white-space: nowrap;
}
.star {
  color: var(--amber);
}
.bar {
  flex: 1;
  height: 8px;
  border-radius: 999px;
  background: var(--surface-soft);
  overflow: hidden;
}
.bar-fill {
  display: block;
  height: 100%;
  border-radius: 999px;
  background: var(--ocean);
}
.bar-percent {
  width: 2.6rem;
  font-size: 0.8rem;
  color: var(--ink-soft);
}
/* small total / average pills beside the heading */
.stat-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.25rem 0.75rem;
  border: 1px solid var(--line);
  border-radius: 999px;
  font-size: 0.875rem;
  color: var(--ink-soft);
}
.stat-label {
  font-size: 0.75rem;
  color: var(--muted);
}
.stat-number {
  font-weight: 600;
  color: var(--ink);
}
.avg-star {
  position: relative;
  display: inline-block;
  font-size: 0.95rem;
  color: var(--line);
}
.avg-star-fill {
  position: absolute;
  inset: 0 auto 0 0;
  overflow: hidden;
  color: var(--amber);
}

/* ---- cards ---- */
.feedback-title {
  font-size: 1.6rem;
  font-weight: 600;
  color: var(--ink);
}
.filter-select {
  border-color: transparent;
  background-color: var(--aqua-soft);
  color: var(--ocean);
  font-weight: 500;
}
.sort-select {
  border-color: var(--ocean);
  background-color: var(--ocean);
  /* white chevron, since the default one is dark */
  background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3e%3cpath fill='none' stroke='%23fff' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='m2 5 6 6 6-6'/%3e%3c/svg%3e");
  color: #fff;
  font-weight: 500;
}
.sort-select option {
  color: var(--ink);
  background: #fff;
}
.cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 2rem;
  align-items: start;
}
.review-card {
  display: flex;
  flex-direction: column;
  padding: 1.5rem;
  border: 1px solid var(--line);
  border-radius: 1.25rem;
  background: var(--surface);
}
.initials {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--aqua-soft);
  color: var(--ocean);
  font-size: 0.7rem;
  font-weight: 600;
}
.reviewer {
  font-size: 1.05rem;
  color: var(--ink);
}
.comment {
  margin: 0.75rem 0 1.25rem;
  color: var(--muted);
  line-height: 1.65;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.card-foot {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.75rem;
  margin-top: auto;
  padding-top: 1.25rem;
  border-top: 1px solid var(--line);
  color: var(--ink);
}
.product-link {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.875rem;
}

/* ---- pages ---- */
.pager {
  display: flex;
  justify-content: center;
  gap: 1.25rem;
  margin-top: 2.5rem;
}
.pager-btn {
  border: 0;
  background: transparent;
  color: var(--ink);
  font-size: 1.1rem;
  padding: 0.1rem 0.4rem;
}
.pager-btn.active {
  color: var(--ocean);
  font-weight: 600;
}
.pager-btn:disabled {
  color: var(--line);
}

@media (max-width: 991.98px) {
  .cards {
    grid-template-columns: repeat(2, 1fr);
    gap: 1rem;
  }
}
@media (max-width: 767.98px) {
  .breakdown {
    width: 100%;
  }
  .cards {
    grid-template-columns: 1fr;
  }
}
</style>
