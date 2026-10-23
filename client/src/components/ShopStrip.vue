<script setup>
import { computed } from 'vue'
import { cleanMrtName } from '@/utils/googleMaps'
import { timeAgo, shortNumber } from '@/utils/format'

// Owner: Cheyenne
// Seller box on the product page (like Shopee's): avatar, shop name, Chat now / View shop, shop stats.
//   <ShopStrip :shop="product.shop" :product-count="n" :can-chat="isBuyer" @chat="chatWithSeller" />
const props = defineProps({
  shop: { type: Object, required: true }, // populated shop (name, nearestMrt, stats, followers, createdAt)
  productCount: { type: Number, default: null },
  canChat: { type: Boolean, default: false },
})
defineEmits(['chat'])

const stats = computed(() => props.shop.stats || {})
const station = computed(() => cleanMrtName(props.shop.nearestMrt))

// avgResponseMins -> "within 20 mins" / "within 3 hours" / "within days"
const responseTime = computed(() => {
  const mins = stats.value.avgResponseMins
  if (!mins) return 'New seller'
  if (mins < 60) return `within ${Math.max(1, Math.round(mins))} mins`
  if (mins < 1440) return `within ${Math.round(mins / 60)} ${Math.round(mins / 60) === 1 ? 'hour' : 'hours'}`
  return 'within days'
})
const items = computed(() => [
  { label: 'Ratings', value: stats.value.reviewCount ? `${Number(stats.value.avgRating).toFixed(1)} ★ (${shortNumber(stats.value.reviewCount)})` : 'No ratings yet' },
  { label: 'Products', value: props.productCount === null ? '-' : String(props.productCount) },
  { label: 'Response time', value: responseTime.value },
  { label: 'Orders fulfilled', value: stats.value.fulfilmentRate ? `${Math.round(stats.value.fulfilmentRate * 100)}%` : '-' },
  { label: 'Joined', value: timeAgo(props.shop.createdAt) || '-' },
  { label: 'Followers', value: shortNumber(stats.value.followerCount ?? props.shop.followers?.length ?? 0) },
])
</script>

<template>
  <section class="card shop-strip" aria-label="About the seller">
    <div class="card-body d-flex flex-wrap align-items-center gap-4">
      <div class="d-flex align-items-center gap-3 seller">
        <span class="avatar" aria-hidden="true">{{ shop.name.charAt(0).toUpperCase() }}</span>
        <div class="min-w-0">
          <h5 class="mb-0 clamp-1">{{ shop.name }}</h5>
          <p class="small text-muted mb-2">{{ station ? `Near ${station} MRT` : 'Home business' }}</p>
          <div class="d-flex gap-2">
            <button v-if="canChat" type="button" class="btn btn-sm btn-outline-primary" @click="$emit('chat')">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                <path d="M2.678 11.894a1 1 0 0 1 .287.801 11 11 0 0 1-.398 2c1.395-.323 2.247-.697 2.634-.893a1 1 0 0 1 .71-.074A8 8 0 0 0 8 14c3.996 0 7-2.807 7-6s-3.004-6-7-6-7 2.808-7 6c0 1.468.617 2.83 1.678 3.894m-.493 3.905a22 22 0 0 1-.713.129c-.2.032-.352-.176-.273-.362a10 10 0 0 0 .244-.637l.003-.01c.248-.72.45-1.548.524-2.319C.743 11.37 0 9.76 0 8c0-3.866 3.582-7 8-7s8 3.134 8 7-3.582 7-8 7a9 9 0 0 1-2.347-.306c-.52.263-1.639.742-3.468 1.105" />
              </svg>
              Chat now
            </button>
            <RouterLink :to="`/shops/${shop._id}`" class="btn btn-sm btn-outline-secondary">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                <path d="M2.97 1.35A1 1 0 0 1 3.73 1h8.54a1 1 0 0 1 .76.35l2.609 3.044A1.5 1.5 0 0 1 16 5.37v.255a2.375 2.375 0 0 1-4.25 1.458A2.37 2.37 0 0 1 9.875 8 2.37 2.37 0 0 1 8 7.083 2.37 2.37 0 0 1 6.125 8a2.37 2.37 0 0 1-1.875-.917A2.375 2.375 0 0 1 0 5.625V5.37a1.5 1.5 0 0 1 .361-.976zm1.78 4.275a1.375 1.375 0 0 0 2.75 0 .5.5 0 0 1 1 0 1.375 1.375 0 0 0 2.75 0 .5.5 0 0 1 1 0 1.375 1.375 0 1 0 2.75 0V5.37a.5.5 0 0 0-.12-.325L12.27 2H3.73L1.12 5.045A.5.5 0 0 0 1 5.37v.255a1.375 1.375 0 0 0 2.75 0 .5.5 0 0 1 1 0M1.5 8.5A.5.5 0 0 1 2 9v6h12V9a.5.5 0 0 1 1 0v6h.5a.5.5 0 0 1 0 1H.5a.5.5 0 0 1 0-1H1V9a.5.5 0 0 1 .5-.5m2 .5a.5.5 0 0 1 .5.5V13h8V9.5a.5.5 0 0 1 1 0V13a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5a.5.5 0 0 1 .5-.5" />
              </svg>
              View shop
            </RouterLink>
          </div>
        </div>
      </div>

      <dl class="stats mb-0">
        <div v-for="item in items" :key="item.label" class="stat">
          <dt>{{ item.label }}</dt>
          <dd>{{ item.value }}</dd>
        </div>
      </dl>
    </div>
  </section>
</template>

<style scoped>
.seller {
  min-width: 260px;
  padding-right: 1.5rem;
}
.avatar {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--teal), var(--lavender));
  box-shadow: 0 4px 12px rgba(var(--lavender-rgb), 0.35);
  font-size: 1.6rem;
  font-weight: 700;
  color: #fff;
}
.min-w-0 {
  min-width: 0;
}
/* stats: 3 columns, label left + value right (like Shopee) */
.stats {
  flex: 1 1 420px;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.9rem 2rem;
  padding-left: 1.5rem;
  border-left: 1px solid var(--line);
}
.stat {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  min-width: 0;
}
.stat dt {
  font-weight: 400;
  color: var(--muted);
}
.stat dd {
  margin: 0;
  font-weight: 600;
  color: var(--teal-dark);
  text-align: right;
  white-space: nowrap;
}
@media (max-width: 991.98px) {
  .seller {
    padding-right: 0;
  }
  .stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    padding-left: 0;
    padding-top: 1rem;
    border-left: 0;
    border-top: 1px solid var(--line);
  }
}
@media (max-width: 479.98px) {
  .stats {
    grid-template-columns: 1fr;
  }
}
</style>
