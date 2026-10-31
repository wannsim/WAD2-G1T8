<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import { currentUser } from '@/utils/auth'
import { API_URL } from '@/utils/config'
import { ORDER_STATUS_BADGE } from '@/utils/constants'
import { calculateSalesAnalytics, formatSalesMoney, percentChange, presetSalesRange, previousSalesRange, salesCsv, validateSalesRange } from '@/utils/salesAnalytics'

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

const trendGrouping = ref('') // Day / Month / Year buttons on the sales trend; '' = picked from the range length
const GROUPINGS = [{ key: 'daily', label: 'Day' }, { key: 'monthly', label: 'Month' }, { key: 'yearly', label: 'Year' }]
const GROUPING_NAME = { daily: 'Daily', monthly: 'Monthly', yearly: 'Yearly' }
const analytics = computed(() => calculateSalesAnalytics(orders.value, range.value, trendGrouping.value))
// same numbers for the period just before, to show "+4.2%" / "-1.4%" on each card
const previous = computed(() => calculateSalesAnalytics(orders.value, previousSalesRange(range.value)))
// bootstrap-icons paths (16x16)
const ICONS = {
  money: 'M4 10.781c.148 1.667 1.513 2.85 3.591 3.003V15h1.043v-1.216c2.27-.179 3.678-1.438 3.678-3.3 0-1.59-.947-2.51-2.956-3.028l-.722-.187V3.467c1.122.11 1.879.714 2.07 1.616h1.47c-.166-1.6-1.54-2.748-3.54-2.875V1H7.591v1.233c-1.939.23-3.27 1.472-3.27 3.156 0 1.454.966 2.483 2.661 2.917l.61.162v4.031c-1.149-.17-1.94-.8-2.131-1.718zm3.391-3.836c-1.043-.263-1.6-.825-1.6-1.616 0-.944.704-1.641 1.8-1.828v3.495l-.2-.05zm1.591 1.872c1.287.323 1.852.859 1.852 1.769 0 1.097-.826 1.828-2.2 1.939V8.73z',
  cart: 'M0 1.5A.5.5 0 0 1 .5 1H2a.5.5 0 0 1 .485.379L2.89 3H14.5a.5.5 0 0 1 .49.598l-1 5a.5.5 0 0 1-.465.401l-9.397.472L4.415 11H13a.5.5 0 0 1 0 1H4a.5.5 0 0 1-.491-.408L2.01 3.607 1.61 2H.5a.5.5 0 0 1-.5-.5M3.102 4l.84 4.479 9.144-.459L13.89 4zM5 12a2 2 0 1 0 0 4 2 2 0 0 0 0-4m7 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4m-7 1a1 1 0 1 1 0 2 1 1 0 0 1 0-2m7 0a1 1 0 1 1 0 2 1 1 0 0 1 0-2',
  box: 'M8.186 1.113a.5.5 0 0 0-.372 0L1.846 3.5 8 5.961 14.154 3.5zM15 4.239l-6.5 2.6v7.922l6.5-2.6V4.24zM7.5 14.762V6.838L1 4.239v7.923zM7.443.184a1.5 1.5 0 0 1 1.114 0l7.129 2.852A.5.5 0 0 1 16 3.5v8.662a1 1 0 0 1-.629.928l-7.185 2.874a.5.5 0 0 1-.372 0L.63 13.09a1 1 0 0 1-.63-.928V3.5a.5.5 0 0 1 .314-.464z',
  receipt: 'M1.92.506a.5.5 0 0 1 .434.14L3 1.293l.646-.647a.5.5 0 0 1 .708 0L5 1.293l.646-.647a.5.5 0 0 1 .708 0L7 1.293l.646-.647a.5.5 0 0 1 .708 0L9 1.293l.646-.647a.5.5 0 0 1 .708 0l.646.647.646-.647a.5.5 0 0 1 .708 0l.646.647.646-.647a.5.5 0 0 1 .801.13l.5 1A.5.5 0 0 1 15 2v12a.5.5 0 0 1-.053.224l-.5 1a.5.5 0 0 1-.8.13L13 14.707l-.646.647a.5.5 0 0 1-.708 0L11 14.707l-.646.647a.5.5 0 0 1-.708 0L9 14.707l-.646.647a.5.5 0 0 1-.708 0L7 14.707l-.646.647a.5.5 0 0 1-.708 0L5 14.707l-.646.647a.5.5 0 0 1-.708 0L3 14.707l-.646.647a.5.5 0 0 1-.801-.13l-.5-1A.5.5 0 0 1 1 14V2a.5.5 0 0 1 .053-.224l.5-1a.5.5 0 0 1 .367-.27m.217 1.338L2 2.118v11.764l.137.274.51-.51a.5.5 0 0 1 .707 0l.646.647.646-.646a.5.5 0 0 1 .708 0l.646.646.646-.646a.5.5 0 0 1 .708 0l.646.646.646-.646a.5.5 0 0 1 .708 0l.646.646.646-.646a.5.5 0 0 1 .708 0l.646.646.646-.646a.5.5 0 0 1 .708 0l.509.509.137-.274V2.118l-.137-.274-.51.51a.5.5 0 0 1-.707 0L12 1.707l-.646.647a.5.5 0 0 1-.708 0L10 1.707l-.646.647a.5.5 0 0 1-.708 0L8 1.707l-.646.647a.5.5 0 0 1-.708 0L6 1.707l-.646.647a.5.5 0 0 1-.708 0L4 1.707l-.646.647a.5.5 0 0 1-.708 0zM3 4.5a.5.5 0 0 1 .5-.5h6a.5.5 0 1 1 0 1h-6a.5.5 0 0 1-.5-.5m0 2a.5.5 0 0 1 .5-.5h6a.5.5 0 1 1 0 1h-6a.5.5 0 0 1-.5-.5m0 2a.5.5 0 0 1 .5-.5h6a.5.5 0 1 1 0 1h-6a.5.5 0 0 1-.5-.5m0 2a.5.5 0 0 1 .5-.5h6a.5.5 0 0 1 0 1h-6a.5.5 0 0 1-.5-.5m8-6a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 0 1h-1a.5.5 0 0 1-.5-.5m0 2a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 0 1h-1a.5.5 0 0 1-.5-.5m0 2a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 0 1h-1a.5.5 0 0 1-.5-.5m0 2a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 0 1h-1a.5.5 0 0 1-.5-.5',
}
const summaryCards = computed(() => {
  const now = analytics.value
  const before = previous.value
  return [
    { label: 'Sales revenue', icon: ICONS.money, value: formatSalesMoney(now.revenueCents),
      change: percentChange(now.revenueCents, before.revenueCents), link: '/seller/orders', linkLabel: 'View shop orders' },
    { label: 'Completed orders', icon: ICONS.cart, value: now.completedOrders.toLocaleString('en-SG'),
      change: percentChange(now.completedOrders, before.completedOrders), link: '/seller/orders', linkLabel: 'View shop orders' },
    { label: 'Units sold', icon: ICONS.box, value: now.unitsSold.toLocaleString('en-SG'),
      change: percentChange(now.unitsSold, before.unitsSold), link: '/seller/shop', linkLabel: 'View my products' },
    { label: 'Average order value', icon: ICONS.receipt, value: formatSalesMoney(now.averageOrderValueCents),
      change: percentChange(now.averageOrderValueCents, before.averageOrderValueCents), link: '/seller/orders', linkLabel: 'View shop orders' },
  ]
})
// "+4.2%" / "-1.4%" / "0.0%"
const formatChange = (change) => `${change > 0 ? '+' : ''}${change.toFixed(1)}%`
// bottom-right label: "Last 7 days", or the custom range's length
const periodLabel = computed(() => {
  if (preset.value !== 'custom') return `Last ${preset.value} days`
  const days = Math.round((Date.parse(range.value.endDate) - Date.parse(range.value.startDate)) / 86400000) + 1
  return `${days} ${days === 1 ? 'day' : 'days'}`
})
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

// "2026-10-29" -> "29 Oct 2026", "2026-10" -> "Oct 2026", "2026" -> "2026"
function displayDate(date) {
  if (date.length === 4) return date
  return new Intl.DateTimeFormat('en-SG', date.length === 7
    ? { month: 'short', year: 'numeric', timeZone: 'Asia/Singapore' }
    : { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Singapore' }
  ).format(new Date(`${date.length === 7 ? `${date}-01` : date}T00:00:00+08:00`))
}

// downloads the completed orders in the chosen range, e.g. "My Shop sales 2026-10-01 to 2026-10-29.csv"
function exportSales() {
  const blob = new Blob([salesCsv(orders.value, range.value)], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${shop.value?.name || 'Shop'} sales ${range.value.startDate} to ${range.value.endDate}.csv`.replace(/[\\/:*?"<>|]/g, '') // characters not allowed in file names
  link.click()
  URL.revokeObjectURL(url)
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
      <div class="d-flex gap-2">
        <button v-if="shop" class="btn btn-brand" :disabled="loading || analytics.completedOrders === 0"
          :title="analytics.completedOrders === 0 ? 'No completed sales in this date range' : 'Download as a file you can open in Excel'" @click="exportSales">
          Export to Excel
        </button>
        <button class="btn soft-btn" :disabled="loading" @click="load">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
            <path fill-rule="evenodd" d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2z" />
            <path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466" />
          </svg>
          {{ loading ? 'Refreshing…' : 'Refresh' }}
        </button>
      </div>
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
          <div class="kpi-card h-100">
            <div class="kpi-head">
              <span class="kpi-icon" aria-hidden="true">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path :d="card.icon" /></svg>
              </span>
              <h2 class="kpi-label">{{ card.label }}</h2>
              <div class="dropdown ms-auto">
                <button class="kpi-menu" type="button" data-bs-toggle="dropdown" aria-expanded="false" :aria-label="`More for ${card.label}`">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M9.5 13a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0m0-5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0m0-5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0" /></svg>
                </button>
                <ul class="dropdown-menu dropdown-menu-end">
                  <li><RouterLink class="dropdown-item" :to="card.link">{{ card.linkLabel }}</RouterLink></li>
                </ul>
              </div>
            </div>
            <div class="kpi-body">
              <p class="kpi-value">{{ card.value }}</p>
              <div class="kpi-foot">
                <span v-if="card.change === null" class="kpi-change text-muted" title="No sales in the period before to compare with">&ndash;</span>
                <span v-else class="kpi-change" :class="card.change < 0 ? 'down' : 'up'" :title="`Compared with the ${periodLabel.toLowerCase()} before`">
                  <svg v-if="card.change < 0" width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M8 1a.5.5 0 0 1 .5.5v11.793l3.146-3.147a.5.5 0 0 1 .708.708l-4 4a.5.5 0 0 1-.708 0l-4-4a.5.5 0 0 1 .708-.708L7.5 13.293V1.5A.5.5 0 0 1 8 1" /></svg>
                  {{ formatChange(card.change) }}
                </span>
                <span class="kpi-period">{{ periodLabel }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="analytics-panel p-3 p-md-4 mb-4">
        <div class="d-flex justify-content-between flex-wrap gap-2 mb-3">
          <div>
            <h2 class="h5 mb-0">Sales trend</h2>
            <span class="text-muted small">{{ GROUPING_NAME[analytics.grouping] }} revenue · SGD</span>
          </div>
          <div class="btn-group btn-group-sm align-self-start" role="group" aria-label="Group sales by">
            <button v-for="g in GROUPINGS" :key="g.key" type="button" class="btn"
              :class="analytics.grouping === g.key ? 'btn-brand' : 'btn-outline-secondary'"
              :aria-pressed="analytics.grouping === g.key" @click="trendGrouping = g.key">{{ g.label }}</button>
          </div>
        </div>
        <div class="chart-scroll">
          <svg class="sales-chart" viewBox="0 0 800 265" role="img" aria-labelledby="sales-chart-title sales-chart-desc">
            <title id="sales-chart-title">Completed-order sales revenue</title>
            <desc id="sales-chart-desc">{{ GROUPING_NAME[analytics.grouping] }} revenue from {{ displayDate(range.startDate) }} to {{ displayDate(range.endDate) }}. Total {{ formatSalesMoney(analytics.revenueCents) }}. Exact values are in the sales data table below.</desc>
            <g v-for="step in [0, 1, 2, 3, 4]" :key="step">
              <line x1="90" x2="750" :y1="205 - step * 43.75" :y2="205 - step * 43.75" stroke="#e3e9f2" />
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
              <thead><tr><th scope="col">{{ { daily: 'Date', monthly: 'Month', yearly: 'Year' }[analytics.grouping] }}</th><th scope="col" class="text-end">Completed orders</th><th scope="col" class="text-end">Revenue (SGD)</th></tr></thead>
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
/* summary cards: icon + label + menu, then a grey box with the number, change and period */
.kpi-card { display: flex; flex-direction: column; padding: 0.5rem; background: #fff; border: 1px solid var(--line); border-radius: 1rem; }
.kpi-head { display: flex; align-items: center; gap: 0.6rem; padding: 0.35rem 0.4rem 0.6rem; }
.kpi-icon { display: inline-flex; align-items: center; justify-content: center; width: 26px; height: 26px; border-radius: 0.4rem; background: var(--tile); color: var(--ink-soft); flex-shrink: 0; }
.kpi-label { margin: 0; font-size: 1rem; font-weight: 500; color: var(--muted); }
.kpi-menu { display: inline-flex; padding: 0.2rem; border: 0; border-radius: 0.4rem; background: transparent; color: var(--ink-soft); }
.kpi-menu:hover, .kpi-menu:focus-visible { background: var(--tile); }
.kpi-body { flex: 1; display: flex; flex-direction: column; padding: 0.9rem 0.75rem 0.75rem; border-radius: 0.75rem; background: var(--surface-soft); }
.kpi-value { margin: 0 0 1.25rem; font-size: clamp(1.5rem, 2.5vw, 2rem); font-weight: 700; color: var(--brand-dark); overflow-wrap: anywhere; }
.kpi-foot { display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; margin-top: auto; font-size: 0.875rem; }
.kpi-change { display: inline-flex; align-items: center; gap: 0.2rem; font-weight: 500; }
.kpi-change.up { color: #1a9e55; }
.kpi-change.down { color: var(--rose); }
.kpi-period { color: var(--ink-soft); }
.chart-scroll { overflow-x: auto; }
.sales-chart { display: block; width: 100%; min-width: 640px; }
.chart-label { font-size: 11px; fill: var(--ink-soft); }
.chart-data-toggle, .analytics-link { color: var(--brand-dark); }
.chart-data-table { max-height: 22rem; }
.product-name { min-width: 8rem; overflow-wrap: anywhere; }
</style>
