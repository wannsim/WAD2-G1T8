<script setup>
// Owner: Wan Sim
// "Forecast" panel on the seller Analytics page. Home sellers don't know how many orders to expect or when,
// so they set slot capacity and stock by guessing - this shows an estimate for the next 4 weeks and the
// busiest weekdays. All the maths is in utils/forecast.js (tested); this file only draws it. See ALGORITHMS.md.
import { computed } from 'vue'
import { busiestSlots, forecastWeeks, hasEnoughHistory, MIN_ORDERS, MIN_WEEKS, weeklyTotals } from '@/utils/forecast'

const props = defineProps({
  orders: { type: Array, default: () => [] }, // every order of the shop (the maths keeps only completed ones)
})

const weekly = computed(() => weeklyTotals(props.orders))
const enough = computed(() => hasEnoughHistory(weekly.value))
const historyOrders = computed(() => weekly.value.reduce((sum, w) => sum + w.orders, 0))
const busiest = computed(() => busiestSlots(props.orders))

// whole orders for display: the estimate rounded, the range rounded outwards (low down, high up)
const estimate = computed(() => forecastWeeks(weekly.value).map((w) => ({
  week: w.week,
  expected: Math.round(w.expected),
  low: Math.floor(w.low),
  high: Math.ceil(w.high),
})))
const past = computed(() => weekly.value.slice(-4)) // last 4 full weeks, drawn grey for comparison

// "2026-11-09" -> "9 Nov" (the week labels are plain dates, so format them in UTC)
const shortDate = (week) => new Intl.DateTimeFormat('en-SG', { day: 'numeric', month: 'short', timeZone: 'UTC' })
  .format(new Date(`${week}T00:00:00Z`))

// ---- chart: 4 past weeks (grey) + 4 estimated weeks (blue, with a low-high whisker) ----
const LEFT = 34
const RIGHT = 396
const TOP = 28
const BOTTOM = 178
const slot = (RIGHT - LEFT) / 8
const chartMax = computed(() => {
  const biggest = Math.max(1, ...past.value.map((w) => w.orders), ...estimate.value.map((w) => w.high))
  return Math.ceil(biggest / 2) * 2 // even number, so the middle grid line is a whole number
})
const y = (value) => BOTTOM - (value / chartMax.value) * (BOTTOM - TOP)
const bars = computed(() => [
  ...past.value.map((w, i) => ({ ...w, value: w.orders, estimate: false, i })),
  ...estimate.value.map((w, i) => ({ ...w, value: w.expected, estimate: true, i: i + 4 })),
].map((bar) => ({ ...bar, x: LEFT + bar.i * slot + slot / 2 })))
</script>

<template>
  <section class="forecast-panel p-3 p-md-4" aria-labelledby="forecast-title">
    <div class="d-flex align-items-center flex-wrap gap-2 mb-1">
      <h2 id="forecast-title" class="h5 mb-0">Forecast</h2>
      <span class="badge estimate-badge">Estimate</span>
    </div>
    <p class="text-muted small mb-3">
      Plan your slot capacity and stock: how many orders to expect in the next 4 weeks, and on which days.
      Completed orders, grouped by pickup/delivery date (Singapore time). Uses all your orders, not the date range in "Sales so far".
    </p>

    <div class="row g-4">
      <div class="col-12 col-lg-8">
        <h3 class="h6">Next 4 weeks</h3>
        <div v-if="!enough" class="empty-box" role="status">
          <p class="fw-semibold mb-1">Not enough orders yet to forecast</p>
          <p class="small text-muted mb-0">
            A forecast needs at least {{ MIN_WEEKS }} full weeks and {{ MIN_ORDERS }} completed orders.
            So far: {{ weekly.length }} {{ weekly.length === 1 ? 'week' : 'weeks' }} and {{ historyOrders }} completed
            {{ historyOrders === 1 ? 'order' : 'orders' }} (this week is not counted until it ends).
          </p>
        </div>
        <template v-else>
          <svg class="forecast-chart" viewBox="0 0 400 214" role="img" aria-labelledby="forecast-chart-title forecast-chart-desc">
            <title id="forecast-chart-title">Completed orders per week: the last 4 weeks and an estimate for the next 4</title>
            <desc id="forecast-chart-desc">
              Estimate for the week of {{ shortDate(estimate[0].week) }}: about {{ estimate[0].expected }} orders
              ({{ estimate[0].low }} to {{ estimate[0].high }}). Every value is in the forecast data table below.
            </desc>
            <!-- grid: 0, half, max -->
            <g v-for="step in [0, 1, 2]" :key="step">
              <line :x1="LEFT" :x2="RIGHT" :y1="y(chartMax * step / 2)" :y2="y(chartMax * step / 2)" class="grid" />
              <text :x="LEFT - 6" :y="y(chartMax * step / 2) + 4" text-anchor="end" class="label">{{ chartMax * step / 2 }}</text>
            </g>
            <line :x1="LEFT + 4 * slot" :x2="LEFT + 4 * slot" :y1="TOP - 18" :y2="BOTTOM" class="divider" />
            <text :x="LEFT + 2 * slot" :y="TOP - 10" text-anchor="middle" class="label">Past weeks</text>
            <text :x="LEFT + 6 * slot" :y="TOP - 10" text-anchor="middle" class="label label-strong">Estimate</text>

            <g v-for="bar in bars" :key="bar.week">
              <rect :x="bar.x - 13" :y="y(bar.value)" width="26" :height="BOTTOM - y(bar.value)" rx="3"
                :class="bar.estimate ? 'bar-estimate' : 'bar-past'" />
              <template v-if="bar.estimate">
                <line :x1="bar.x" :x2="bar.x" :y1="y(bar.high)" :y2="y(bar.low)" class="whisker" />
                <line :x1="bar.x - 6" :x2="bar.x + 6" :y1="y(bar.high)" :y2="y(bar.high)" class="whisker" />
                <line :x1="bar.x - 6" :x2="bar.x + 6" :y1="y(bar.low)" :y2="y(bar.low)" class="whisker" />
              </template>
              <text :x="bar.x" :y="y(bar.estimate ? bar.high : bar.value) - 5" text-anchor="middle" class="label label-strong">
                {{ bar.estimate ? `~${bar.value}` : bar.value }}
              </text>
              <!-- day on one line, month under it, so 8 dates fit side by side on a phone -->
              <text :x="bar.x" :y="BOTTOM + 15" text-anchor="middle" class="label">
                <tspan :x="bar.x">{{ shortDate(bar.week).split(' ')[0] }}</tspan>
                <tspan :x="bar.x" dy="13">{{ shortDate(bar.week).split(' ')[1] }}</tspan>
              </text>
            </g>
          </svg>
          <p class="small text-muted mb-1">
            Blue bar = estimate; the thin line shows the likely range. Dates are the Monday each week starts.
          </p>
          <details>
            <summary class="data-toggle">View forecast data table</summary>
            <div class="table-responsive mt-2">
              <table class="table table-sm mb-0">
                <caption class="visually-hidden">Estimated completed orders for the next 4 weeks</caption>
                <thead>
                  <tr><th scope="col">Week starting</th><th scope="col" class="text-end">Estimate</th><th scope="col" class="text-end">Range</th></tr>
                </thead>
                <tbody>
                  <tr v-for="w in estimate" :key="w.week">
                    <th scope="row" class="fw-normal">{{ shortDate(w.week) }}</th>
                    <td class="text-end">about {{ w.expected }}</td>
                    <td class="text-end">{{ w.low }} – {{ w.high }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </details>
        </template>
      </div>

      <div class="col-12 col-lg-4">
        <h3 class="h6">Busiest weekdays</h3>
        <p v-if="busiest.suggestion" class="suggestion small mb-3" role="status">{{ busiest.suggestion }}</p>
        <p v-else class="small text-muted mb-3">
          A suggestion appears after {{ MIN_ORDERS }} completed orders.
        </p>
        <ul class="list-unstyled mb-0" aria-label="Completed orders per weekday">
          <li v-for="d in busiest.days" :key="d.day" class="day-row">
            <span class="day-name">{{ d.day.slice(0, 3) }}</span>
            <span class="day-track" aria-hidden="true">
              <span class="day-fill" :class="{ top: busiest.top.includes(d.day) }"
                :style="{ width: `${d.orders ? (d.orders / Math.max(...busiest.days.map((x) => x.orders))) * 100 : 0}%` }"></span>
            </span>
            <span class="day-count">{{ d.orders }}<span class="visually-hidden"> completed orders on {{ d.day }}</span></span>
          </li>
        </ul>
      </div>
    </div>

    <details class="mt-3">
      <summary class="data-toggle">How is this calculated?</summary>
      <div class="small text-muted mt-2">
        <p class="mb-2">
          We count only completed orders, by the week of their pickup/delivery date in Singapore time.
          This week is left out until it ends. The estimate adds two things together:
          (1) your recent level - an average of your last 4 weeks where the newest week counts most, and
          (2) your trend - a straight line through up to your last 12 weeks that shows how many orders you gain
          or lose each week.
        </p>
        <p class="mb-2">
          The range shows how far your past weeks typically were from that trend line, and it gets wider the
          further ahead it looks. It is a typical spread of past misses, not a guarantee: a holiday, a busy
          festival week or a quiet week can land outside it.
        </p>
        <p class="mb-0">
          Busiest weekdays count every completed order by the weekday of its pickup/delivery time. We only name
          days when your 2 busiest days have at least 40% of your completed orders (if orders were spread evenly,
          any 2 days would have about 29%). Otherwise we say your orders are spread fairly evenly across the week.
        </p>
      </div>
    </details>
  </section>
</template>

<style scoped>
.forecast-panel { background: var(--surface); border: 1px solid var(--line); border-radius: 1rem; box-shadow: 0 4px 16px rgb(0 0 0 / 3%); }
.estimate-badge { background: var(--ocean-soft); color: var(--ocean-dark); font-weight: 600; }
.empty-box { padding: 1rem; border-radius: 0.75rem; background: var(--surface-soft); }
.forecast-chart { display: block; width: 100%; max-width: 560px; height: auto; }
.grid { stroke: var(--line); }
.divider { stroke: var(--line); stroke-dasharray: 4 3; }
/* 13 units = about 10-11px on a 375px phone, where the whole chart is shrunk to fit */
.label { font-size: 13px; fill: var(--ink-soft); }
.label-strong { fill: var(--ink); font-weight: 600; }
.bar-past { fill: var(--line); }
.bar-estimate { fill: var(--ocean-soft); stroke: var(--ocean); stroke-width: 1.5; }
.whisker { stroke: var(--ocean-dark); stroke-width: 2; }
.data-toggle { color: var(--brand-dark); }
.suggestion { padding: 0.6rem 0.75rem; border-radius: 0.75rem; background: var(--ocean-soft); color: var(--ocean-dark); font-weight: 500; }
.day-row { display: flex; align-items: center; gap: 0.5rem; padding: 0.2rem 0; font-size: 0.85rem; }
.day-name { width: 2.2rem; color: var(--ink-soft); }
.day-track { flex: 1; height: 0.6rem; border-radius: 999px; background: var(--surface-soft); overflow: hidden; }
.day-fill { display: block; height: 100%; border-radius: 999px; background: var(--line); }
.day-fill.top { background: var(--ocean); }
.day-count { width: 2rem; text-align: right; font-weight: 600; }
</style>
