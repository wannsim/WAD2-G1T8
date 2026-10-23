<script setup>
import { ref, computed, watch } from 'vue'
import axios from 'axios'
import { API_URL } from '@/utils/config'
import { formatShortDateTime } from '@/utils/format'
import StarRating from './StarRating.vue'

// Owner: Cheyenne
// "Product ratings" on the product page (like Shopee): average, filter by stars / with comments,
// and the whole list of reviews (5 at a time, "Show more" for the rest).
//   <ProductReviews :product-id="product._id" />
const props = defineProps({ productId: { type: String, required: true } })

const PAGE_SIZE = 5
const reviews = ref([])
const loading = ref(true)
const error = ref('')
const filter = ref('all') // 'all' | 5 | 4 | 3 | 2 | 1 | 'comments'
const shownCount = ref(PAGE_SIZE)

async function load() {
  loading.value = true
  error.value = ''
  try {
    const res = await axios.get(`${API_URL}/reviews/product/${props.productId}`)
    reviews.value = res.data
  } catch (err) {
    error.value = 'Could not load reviews. Please try again.'
  } finally {
    loading.value = false
  }
}
watch(() => props.productId, load, { immediate: true })

const average = computed(() =>
  reviews.value.length ? reviews.value.reduce((sum, r) => sum + r.rating, 0) / reviews.value.length : 0)
const countFor = (stars) => reviews.value.filter((r) => r.rating === stars).length
const withComments = computed(() => reviews.value.filter((r) => r.comment?.trim()).length)

const filters = computed(() => [
  { key: 'all', label: 'All', count: reviews.value.length },
  ...[5, 4, 3, 2, 1].map((n) => ({ key: n, label: `${n} Star`, count: countFor(n) })),
  { key: 'comments', label: 'With comments', count: withComments.value },
])
const filtered = computed(() => {
  if (filter.value === 'all') return reviews.value
  if (filter.value === 'comments') return reviews.value.filter((r) => r.comment?.trim())
  return reviews.value.filter((r) => r.rating === filter.value)
})
const visible = computed(() => filtered.value.slice(0, shownCount.value))
watch(filter, () => (shownCount.value = PAGE_SIZE)) // new filter starts at the top

const initial = (review) => (review.buyer?.name || 'B').charAt(0).toUpperCase()
</script>

<template>
  <section class="card" aria-labelledby="ratings-title">
    <div class="card-body p-4">
      <h4 id="ratings-title" class="mb-3">Product ratings</h4>

      <p v-if="loading" class="text-muted mb-0">Loading reviews...</p>
      <div v-else-if="error" class="alert alert-warning mb-0">
        {{ error }} <button type="button" class="btn btn-sm btn-outline-secondary ms-2" @click="load">Retry</button>
      </div>
      <p v-else-if="reviews.length === 0" class="text-muted mb-0">No reviews yet. Buyers can review after their order is completed.</p>

      <template v-else>
        <!-- overview + filters -->
        <div class="overview d-flex flex-wrap align-items-center gap-4 mb-3">
          <div class="text-center">
            <div class="avg"><span class="avg-number">{{ average.toFixed(1) }}</span> out of 5</div>
            <StarRating :value="average" />
          </div>
          <div class="d-flex flex-wrap gap-2" role="group" aria-label="Filter reviews">
            <button v-for="f in filters" :key="f.key" type="button" class="filter-chip" :class="{ active: filter === f.key }"
              :aria-pressed="filter === f.key" @click="filter = f.key">
              {{ f.label }} ({{ f.count }})
            </button>
          </div>
        </div>

        <p v-if="filtered.length === 0" class="text-muted">No reviews match this filter.</p>
        <article v-for="r in visible" :key="r._id" class="review d-flex gap-3">
          <span class="avatar" aria-hidden="true">{{ initial(r) }}</span>
          <div class="flex-grow-1 min-w-0">
            <div class="fw-semibold small">{{ r.buyer?.name || 'Buyer' }}</div>
            <span role="img" :aria-label="`${r.rating} out of 5 stars`"><StarRating :value="r.rating" class="small-stars" /></span>
            <div class="small text-muted mb-2">{{ formatShortDateTime(r.createdAt) }}</div>
            <p v-if="r.comment?.trim()" class="comment mb-0">{{ r.comment }}</p>
            <p v-else class="text-muted small mb-0">No written comment.</p>
          </div>
        </article>

        <div v-if="filtered.length > visible.length" class="text-center mt-3">
          <button type="button" class="btn btn-outline-secondary" @click="shownCount += PAGE_SIZE">
            Show more reviews ({{ filtered.length - visible.length }} more)
          </button>
        </div>
      </template>
    </div>
  </section>
</template>

<style scoped>
.overview {
  padding: 1.25rem 1.5rem;
  border: 1px solid #e3d9f6;
  border-radius: 1rem;
  background: var(--lavender-soft);
}
.avg {
  color: var(--lavender-dark);
}
.avg-number {
  font-size: 2rem;
  font-weight: 700;
}
.filter-chip {
  min-width: 96px;
  padding: 0.35rem 0.9rem;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: #fff;
  font-size: 0.875rem;
  color: var(--ink-soft);
}
.filter-chip:hover {
  border-color: var(--lavender);
}
.filter-chip.active {
  border-color: var(--lavender-dark);
  background: #fff;
  color: var(--lavender-dark);
  box-shadow: inset 0 0 0 1px var(--lavender-dark);
  font-weight: 600;
}
.review {
  padding: 1rem 0;
  border-bottom: 1px solid var(--line);
}
.review:last-of-type {
  border-bottom: 0;
}
.avatar {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--surface-hover);
  font-weight: 600;
  color: var(--ink-soft);
}
.small-stars :deep(span) {
  font-size: 0.95rem;
}
.comment {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.min-w-0 {
  min-width: 0;
}
</style>
