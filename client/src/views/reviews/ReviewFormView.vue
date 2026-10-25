<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import axios from 'axios'
import { API_URL } from '@/utils/config'
import { currentUser } from '@/utils/auth'
import { formatDateTime } from '@/utils/format'

// Owner: Yu Chen - /review/:orderId  (buyer reviews a completed order)
// Layout inspired by Shopee's "Rate product": product row, big stars with a label, quick tags, comment.
const route = useRoute()
const router = useRouter()
const rating = ref(5)
const hovered = ref(0) // star under the mouse, so the label previews before clicking
const comment = ref('')
const picked = ref([]) // quick tags the buyer ticked
const error = ref('')
const submitting = ref(false)
const loading = ref(true)
const order = ref(null) // the order being reviewed (shows which product), from GET /orders/buyer/:userId

const MAX_COMMENT = 500
const LABELS = ['', 'Terrible', 'Poor', 'Fair', 'Good', 'Amazing']
// quick tags change with the rating, like Shopee
const GOOD_TAGS = ['Tasty / great quality', 'As described', 'Well packaged', 'Great value', 'Friendly seller', 'On time']
const BAD_TAGS = ['Not as described', 'Poor quality', 'Badly packaged', 'Late', 'Overpriced', 'Seller hard to reach']

const shownRating = computed(() => hovered.value || rating.value)
const tags = computed(() => (rating.value >= 4 ? GOOD_TAGS : rating.value <= 2 ? BAD_TAGS : [...GOOD_TAGS.slice(0, 3), ...BAD_TAGS.slice(0, 3)]))
const photo = computed(() => (order.value?.product ? `${API_URL}/products/${order.value.product._id}/image/0` : '/placeholder.svg'))
// the tags go in front of the comment, so every review page shows them without any server change
const fullComment = computed(() => [picked.value.join(' · '), comment.value.trim()].filter(Boolean).join('\n'))
const tooLong = computed(() => fullComment.value.length > MAX_COMMENT)

function setRating(n) {
  rating.value = n
  picked.value = picked.value.filter((t) => tags.value.includes(t)) // drop tags that no longer fit
}

function toggleTag(tag) {
  picked.value = picked.value.includes(tag) ? picked.value.filter((t) => t !== tag) : [...picked.value, tag]
}

function useFallbackImage(event) {
  if (!event.target.src.endsWith('/placeholder.svg')) event.target.src = '/placeholder.svg'
}

onMounted(async () => {
  if (!currentUser.value) return router.push('/login')
  try {
    const res = await axios.get(`${API_URL}/orders/buyer/${currentUser.value._id}`)
    order.value = res.data.find((o) => o._id === route.params.orderId) || null
  } catch (err) {
    // the form still works without the product details
  } finally {
    loading.value = false
  }
})

async function submitReview() {
  if (submitting.value) return
  error.value = ''
  if (tooLong.value) {
    error.value = `Please keep your review under ${MAX_COMMENT} characters.`
    return
  }
  submitting.value = true
  try {
    await axios.post(`${API_URL}/reviews`, {
      order: route.params.orderId,
      buyer: currentUser.value._id,
      rating: rating.value,
      comment: fullComment.value,
    })
    router.push('/orders')
  } catch (err) {
    error.value = err.response?.data?.message || err.message
    submitting.value = false
  }
}
</script>

<template>
  <div class="page-narrow review-page">
    <h2 class="page-title">Rate product</h2>

    <p v-if="loading" class="text-muted">Loading...</p>
    <section v-else class="review-card">
      <!-- the product being reviewed -->
      <div class="product-row">
        <img :src="photo" alt="" class="product-thumb" @error="useFallbackImage" />
        <div class="min-w-0">
          <div class="fw-semibold text-break clamp-2 product-name">{{ order?.product?.name || 'Product removed' }}</div>
          <div v-if="order" class="small text-muted">Quantity: {{ order.quantity }}<template v-if="order.requestedTime"> &middot; {{ formatDateTime(order.requestedTime) }}</template></div>
          <RouterLink v-if="order?.shop" :to="`/shops/${order.shop._id}`" class="small shop-link">{{ order.shop.name }}</RouterLink>
        </div>
      </div>

      <div v-if="order && order.reviewed" class="alert alert-info mt-3 mb-0">
        You already reviewed this order. Thank you! <RouterLink to="/orders">Back to my orders</RouterLink>
      </div>

      <template v-else>
        <!-- stars + label -->
        <div class="rating-row">
          <span class="rating-title">Product quality</span>
          <div class="stars" role="radiogroup" aria-label="Your rating" @mouseleave="hovered = 0">
            <button v-for="n in 5" :key="n" type="button" class="star" :class="{ on: n <= shownRating }"
              role="radio" :aria-checked="rating === n" :aria-label="`${n} star${n > 1 ? 's' : ''} - ${LABELS[n]}`"
              @mouseenter="hovered = n" @focus="hovered = n" @blur="hovered = 0" @click="setRating(n)">★</button>
          </div>
          <span class="rating-label" :class="`r${shownRating}`" data-testid="rating-label">{{ LABELS[shownRating] }}</span>
        </div>

        <!-- quick tags -->
        <div class="mb-3">
          <div class="small text-muted mb-2">What stood out? <span class="text-muted">(optional)</span></div>
          <div class="d-flex flex-wrap gap-2">
            <button v-for="tag in tags" :key="tag" type="button" class="tag-chip" :class="{ active: picked.includes(tag) }"
              :aria-pressed="picked.includes(tag)" @click="toggleTag(tag)">{{ tag }}</button>
          </div>
        </div>

        <!-- comment -->
        <div class="comment-box" :class="{ 'is-invalid': tooLong }">
          <label class="visually-hidden" for="review-comment">Comment</label>
          <textarea id="review-comment" v-model="comment" rows="5" class="form-control"
            placeholder="Share more about the taste, quality and how the seller handled your order, to help other buyers."></textarea>
          <div class="counter" :class="{ 'text-danger': tooLong }">{{ fullComment.length }}/{{ MAX_COMMENT }}</div>
        </div>

        <div v-if="error" class="alert alert-danger mt-3 mb-0">{{ error }}</div>

        <div class="actions">
          <RouterLink to="/orders" class="btn btn-outline-secondary">Cancel</RouterLink>
          <button class="btn btn-brand px-4" :disabled="submitting || tooLong" @click="submitReview">
            <template v-if="submitting"><span class="spinner-border spinner-border-sm"></span> Submitting…</template>
            <template v-else>Submit review</template>
          </button>
        </div>
      </template>
    </section>
  </div>
</template>

<style scoped>
.review-card {
  padding: 1.5rem;
  border: 1px solid var(--line);
  border-radius: 1.1rem;
  background: var(--surface);
  box-shadow: var(--shadow);
}
.product-row {
  display: flex;
  gap: 1rem;
  align-items: center;
  padding-bottom: 1.25rem;
  border-bottom: 1px solid var(--line);
}
.product-thumb {
  width: 72px;
  height: 72px;
  flex-shrink: 0;
  border-radius: 0.75rem;
  object-fit: cover;
  background: var(--surface-hover);
}
.min-w-0 { min-width: 0; }
.product-name { min-height: 0; color: var(--navy); }
.shop-link { color: var(--ocean-dark); text-decoration: none; }
.shop-link:hover { text-decoration: underline; }

.rating-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem 1.25rem;
  padding: 1.25rem 0;
}
.rating-title { font-weight: 600; color: var(--navy); }
.stars { display: flex; gap: 0.15rem; }
.star {
  padding: 0 0.1rem;
  border: none;
  background: none;
  font-size: 2.1rem;
  line-height: 1;
  color: var(--line);
  cursor: pointer;
  transition: transform 0.12s ease, color 0.12s ease;
}
.star.on { color: var(--amber); }
.star:hover { transform: scale(1.15); }
.star:focus-visible { outline: 2px solid var(--ocean); outline-offset: 2px; border-radius: 4px; }
.rating-label { min-width: 5rem; font-weight: 600; }
.rating-label.r1, .rating-label.r2 { color: var(--rose); }
.rating-label.r3 { color: var(--ink-soft); }
.rating-label.r4, .rating-label.r5 { color: #b7801a; }

.tag-chip {
  padding: 0.35rem 0.85rem;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: var(--surface);
  color: var(--ink-soft);
  font-size: 0.875rem;
  transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
}
.tag-chip:hover { border-color: var(--ocean); color: var(--navy); }
.tag-chip.active {
  border-color: var(--ocean);
  background: var(--ocean-soft);
  color: var(--ocean-dark);
  font-weight: 500;
}

.comment-box {
  position: relative;
}
.comment-box textarea {
  padding-bottom: 1.75rem; /* room for the counter */
  background: var(--surface-soft);
  resize: vertical;
}
.comment-box.is-invalid textarea { border-color: var(--rose); }
.counter {
  position: absolute;
  right: 0.85rem;
  bottom: 0.5rem;
  font-size: 0.75rem;
  color: var(--muted);
  pointer-events: none;
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 1.25rem;
}
@media (max-width: 575.98px) {
  .review-card { padding: 1.1rem; }
  .actions > * { flex: 1; }
}
</style>
