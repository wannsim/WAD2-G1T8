<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import { currentUser } from '@/utils/auth'
import { API_URL } from '@/utils/config'
import { ORDER_STATUS_BADGE } from '@/utils/constants'
import { calculateSalesAnalytics, formatSalesMoney, presetSalesRange, validateSalesRange } from '@/utils/salesAnalytics'

const router = useRouter()
const shop = ref(null)
const orders = ref([])
const loading = ref(false)
const error = ref('')
const preset = ref('30')
const range = ref(presetSalesRange())
const customStart = ref(range.value.startDate)
const customEnd = ref(range.value.endDate)
const rangeError = ref('')
let controller

const analytics = computed(() => calculateSalesAnalytics(orders.value, range.value))
const summaryCards = computed(() => [
  { label: 'Sales revenue', value: formatSalesMoney(analytics.value.revenueCents), detail: 'From completed orders' },
  { label: 'Completed orders', value: analytics.value.completedOrders.toLocaleString('en-SG'), detail: 'Placed in this period' },
  { label: 'Units sold', value: analytics.value.unitsSold.toLocaleString('en-SG'), detail: 'Across completed orders' },
  { label: 'Average order value', value: formatSalesMoney(analytics.value.averageOrderValueCents), detail: 'Per completed order with a valid amount' },
])
const statusLabels = { pending: 'Pending', accepted: 'Accepted', declined: 'Declined', rescheduled: 'Rescheduled', completed: 'Completed', cancelled: 'Cancelled' }
const chartMax = computed(() => Math.max(100, ...analytics.value.trend.map((point) => point.revenueCents)))
const chartPoints = computed(() => analytics.value.trend.map((point, index, points) => ({
  ...point,
  x: points.length === 1 ? 420 : 90 + index / (points.length - 1) * 660,
  y: 205 - point.revenueCents / chartMax.value * 175,
})))
const chartLine = computed(() => chartPoints.value.map((point) => `${point.x},${point.y}`).join(' '))
const axisLabels = computed(() => chartPoints.value.filter((point, index, points) =>
  index === 0 || index === points.length - 1 || index % Math.max(1, Math.ceil((points.length - 1) / 5)) === 0,
))

function displayDate(date) {
  return new Intl.DateTimeFormat('en-SG', date.length === 7
    ? { month: 'short', year: 'numeric', timeZone: 'Asia/Singapore' }
    : { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Singapore' }
  ).format(new Date(`${date.length === 7 ? `${date}-01` : date}T00:00:00+08:00`))
}

function changePreset() {
  rangeError.value = ''
  if (preset.value === 'custom') {
    customStart.value = range.value.startDate
    customEnd.value = range.value.endDate
    return
  }
  range.value = presetSalesRange(Number(preset.value))
}

function applyCustomRange() {
  rangeError.value = validateSalesRange(customStart.value, customEnd.value)
  if (!rangeError.value) range.value = { startDate: customStart.value, endDate: customEnd.value }
}

async function load() {
  controller?.abort()
  shop.value = null
  orders.value = []
  error.value = ''
  const user = currentUser.value
  if (!user || user.role !== 'seller') {
    loading.value = false
    router.replace(user ? '/home' : '/login')
    return
  }
  const request = new AbortController()
  controller = request
  loading.value = true
  try {
    const response = await axios.get(`${API_URL}/shops/mine/${user._id}`, { signal: request.signal })
    if (request.signal.aborted) return
    if (!response.data) return
    const orderResponse = await axios.get(`${API_URL}/orders/shop/${response.data._id}`, { signal: request.signal })
    if (request.signal.aborted) return
    shop.value = response.data
    orders.value = orderResponse.data
  } catch (err) {
    if (!request.signal.aborted) error.value = 'Could not load your sales analytics. Please try again.'
  } finally {
    if (controller === request) loading.value = false
  }
}

watch(() => [currentUser.value?._id, currentUser.value?.role], load, { immediate: true })
onBeforeUnmount(() => controller?.abort())
</script>

<template>
  <section aria-labelledby="analytics-title" :aria-busy="loading">
    <div class="d-flex justify-content-between align-items-start flex-wrap gap-3 mb-4">
      <div>
        <h1 id="analytics-title" class="page-title mb-1">Sales analytics</h1>
        <p class="text-muted mb-0">{{ shop ? `${shop.name} · ` : '' }}Completed orders, grouped by order placed date.</p>
      </div>
      <button class="btn btn-outline-secondary" :disabled="loading" @click="load">
        {{ loading ? 'Refreshing…' : 'Refresh' }}
      </button>
    </div>

    <div v-if="loading" class="analytics-panel text-center py-5" role="status">
      <span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>Loading your sales analytics…
    </div>
    <div v-else-if="error" class="alert alert-danger" role="alert">
      {{ error }} <button class="btn btn-sm btn-outline-danger ms-2" @click="load">Retry</button>
    </div>
    <div v-else-if="!shop" class="analytics-panel p-4">
      <h2 class="h5">Set up your shop to see sales analytics</h2>
      <p class="text-muted">Once your shop receives orders, you can track its performance here.</p>
      <RouterLink class="btn btn-brand" to="/profile">Set up shop</RouterLink>
    </div>
    <template v-else>
      <div class="analytics-panel p-3 mb-4">
        <div class="d-flex align-items-end flex-wrap gap-3">
          <div>
            <label class="form-label" for="sales-period">Date range</label>
            <select id="sales-period" v-model="preset" class="form-select" @change="changePreset">
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
              <option value="custom">Custom range</option>
            </select>
          </div>
          <form v-if="preset === 'custom'" class="d-flex align-items-end flex-wrap gap-2" @submit.prevent="applyCustomRange" novalidate>
            <div>
              <label class="form-label" for="sales-start">Start date</label>
              <input id="sales-start" v-model="customStart" type="date" class="form-control" :aria-invalid="!!rangeError" :aria-describedby="rangeError ? 'range-error' : undefined">
            </div>
            <div>
              <label class="form-label" for="sales-end">End date</label>
              <input id="sales-end" v-model="customEnd" type="date" class="form-control" :aria-invalid="!!rangeError" :aria-describedby="rangeError ? 'range-error' : undefined">
            </div>
            <button class="btn btn-brand" type="submit">Apply</button>
          </form>
          <p class="text-muted small mb-1">{{ displayDate(range.startDate) }} – {{ displayDate(range.endDate) }} · Singapore time</p>
        </div>
        <p v-if="rangeError" id="range-error" class="text-danger small mt-2 mb-0" role="alert">{{ rangeError }}</p>
      </div>

      <p v-if="analytics.orderCount === 0" class="alert alert-info" role="status">No orders were placed in this period. Try another date range.</p>
      <p v-else-if="analytics.completedOrders === 0" class="alert alert-info" role="status">You have orders in this period, but no completed sales yet. See their statuses below.</p>
      <p v-if="analytics.missingAmountCount" class="alert alert-warning" role="status">
        {{ analytics.missingAmountCount }} completed {{ analytics.missingAmountCount === 1 ? 'order has' : 'orders have' }} a missing or invalid historical amount.
        Revenue, the chart, and product revenue include only valid saved amounts. Average order value uses the {{ analytics.pricedOrderCount }} completed orders with valid amounts; order and unit counts include all completed orders.
      </p>

      <div class="row g-3 mb-4">
        <div v-for="card in summaryCards" :key="card.label" class="col-12 col-sm-6 col-xl-3">
          <div class="analytics-panel p-4 h-100">
            <h2 class="h6 text-muted">{{ card.label }}</h2>
            <p class="metric-value mb-1">{{ card.value }}</p>
            <p class="small text-muted mb-0">{{ card.detail }}</p>
          </div>
        </div>
      </div>

      <div class="analytics-panel p-3 p-md-4 mb-4">
        <div class="d-flex justify-content-between flex-wrap gap-2 mb-3">
          <h2 class="h5 mb-0">Sales trend</h2>
          <span class="text-muted small">{{ analytics.grouping === 'daily' ? 'Daily' : 'Monthly' }} revenue · SGD</span>
        </div>
        <div class="chart-scroll">
          <svg class="sales-chart" viewBox="0 0 800 265" role="img" aria-labelledby="sales-chart-title sales-chart-desc">
            <title id="sales-chart-title">Completed-order sales revenue</title>
            <desc id="sales-chart-desc">{{ analytics.grouping === 'daily' ? 'Daily' : 'Monthly' }} revenue from {{ displayDate(range.startDate) }} to {{ displayDate(range.endDate) }}. Total {{ formatSalesMoney(analytics.revenueCents) }}. Exact values are in the sales data table below.</desc>
            <g v-for="step in [0, 1, 2, 3, 4]" :key="step">
              <line x1="90" x2="750" :y1="205 - step * 43.75" :y2="205 - step * 43.75" stroke="#dfe6f3" />
              <text x="78" :y="209 - step * 43.75" text-anchor="end" class="chart-label">{{ formatSalesMoney(Math.round(chartMax * step / 4)) }}</text>
            </g>
            <polyline :points="chartLine" fill="none" stroke="var(--brand)" stroke-width="3" stroke-linejoin="round" />
            <circle v-for="point in chartPoints" :key="point.date" :cx="point.x" :cy="point.y" r="3" fill="var(--brand)">
              <title>{{ displayDate(point.date) }}: {{ formatSalesMoney(point.revenueCents) }}</title>
            </circle>
            <text v-for="point in axisLabels" :key="point.date" :x="point.x" y="235" text-anchor="middle" class="chart-label">{{ displayDate(point.date) }}</text>
          </svg>
        </div>
        <details class="mt-2">
          <summary class="chart-data-toggle">View sales data table</summary>
          <div class="table-responsive mt-3 chart-data-table">
            <table class="table table-sm mb-0">
              <caption class="visually-hidden">Sales trend data for the selected date range</caption>
              <thead><tr><th scope="col">{{ analytics.grouping === 'daily' ? 'Date' : 'Month' }}</th><th scope="col" class="text-end">Completed orders</th><th scope="col" class="text-end">Revenue (SGD)</th></tr></thead>
              <tbody><tr v-for="point in analytics.trend" :key="point.date"><th scope="row" class="fw-normal">{{ displayDate(point.date) }}</th><td class="text-end">{{ point.completedOrders }}</td><td class="text-end">{{ formatSalesMoney(point.revenueCents) }}</td></tr></tbody>
            </table>
          </div>
        </details>
      </div>

      <div class="row g-4">
        <div class="col-12 col-lg-8">
          <div class="analytics-panel p-3 p-md-4 h-100">
            <h2 class="h5">Top products</h2>
            <p class="text-muted small">Top five by completed-order revenue in this period.</p>
            <p v-if="!analytics.topProducts.length" class="text-muted mb-0">Products will appear here after an order is completed.</p>
            <div v-else class="table-responsive">
              <table class="table align-middle mb-0">
                <caption class="visually-hidden">Top products by revenue</caption>
                <thead><tr><th scope="col">Product</th><th scope="col" class="text-end">Units</th><th scope="col" class="text-end">Orders</th><th scope="col" class="text-end">Revenue (SGD)</th></tr></thead>
                <tbody>
                  <tr v-for="product in analytics.topProducts" :key="product.productId">
                    <th scope="row" class="fw-normal product-name">{{ product.name }}</th>
                    <td class="text-end">{{ product.units }}</td><td class="text-end">{{ product.orders }}</td>
                    <td class="text-end text-nowrap">{{ product.pricedOrders ? formatSalesMoney(product.revenueCents) : 'Unavailable' }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <div class="col-12 col-lg-4">
          <div class="analytics-panel p-3 p-md-4 h-100">
            <h2 class="h5">Order statuses</h2>
            <p class="text-muted small">All {{ analytics.orderCount }} orders placed in this period.</p>
            <ul class="list-unstyled mb-3">
              <li v-for="(count, status) in analytics.statusCounts" :key="status" class="d-flex justify-content-between align-items-center py-2 border-bottom">
                <span class="badge" :class="ORDER_STATUS_BADGE[status]">{{ statusLabels[status] }}</span><span class="fw-semibold">{{ count }}</span>
              </li>
            </ul>
            <RouterLink to="/seller/orders" class="analytics-link">Manage shop orders →</RouterLink>
          </div>
        </div>
      </div>
    </template>
  </section>
</template>

<style scoped>
.analytics-panel { background: #fff; border: 1px solid var(--line); border-radius: 1rem; box-shadow: 0 4px 16px rgb(0 0 0 / 3%); }
.metric-value { color: var(--brand-dark); font-size: clamp(1.5rem, 2.5vw, 2rem); font-weight: 700; overflow-wrap: anywhere; }
.chart-scroll { overflow-x: auto; }
.sales-chart { display: block; width: 100%; min-width: 640px; }
.chart-label { font-size: 11px; fill: var(--ink-soft); }
.chart-data-toggle, .analytics-link { color: var(--brand-dark); }
.chart-data-table { max-height: 22rem; }
.product-name { min-width: 8rem; overflow-wrap: anywhere; }
</style>
