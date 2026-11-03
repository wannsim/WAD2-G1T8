// Shared lists. If you add a category here, also add it to server/utils/productRules.js (the server checks it).
// ONE list for the whole site: product category, shop categories, buyer interests, Browse / Map / For you filters.
// The first 6 are the original ones (existing products use them) - don't rename them.
export const CATEGORIES = [
  // food & drink
  'Baked goods',
  'Cakes & cupcakes',
  'Kueh & traditional treats',
  'Snacks & desserts',
  'Meals',
  'Frozen & ready-to-cook',
  'Sauces, jams & spreads',
  'Healthy & dietary',
  'Drinks',
  'Festive & gift hampers',
  // handmade & lifestyle
  'Handmade crafts',
  'Jewellery & accessories',
  'Candles & home scents',
  'Clothing & textiles',
  'Art, prints & stationery',
  'Beauty & self-care',
  'Plants & flowers',
  'Pet treats & supplies',
  'Kids & baby',
  // services
  'Classes & workshops',
  'Services',
  'Others', // always last
]

// old free-text shop categories ("baked goods", "crafts") -> the matching list item, else 'Others'
export function toCategory(text) {
  const t = String(text || '').trim().toLowerCase()
  return CATEGORIES.find((c) => c.toLowerCase() === t) || 'Others'
}
export const toCategories = (list) => [...new Set((list || []).map(toCategory))]

// units a seller can sell by (price is "per unit")
export const UNITS = ['piece', 'box', 'pack', 'set', 'dozen', 'slice', 'jar', 'bottle', 'kg', 'session', 'hour']

// badge classes for each order status (used with :class="ORDER_STATUS_BADGE[order.status]")
// status-* colours live in assets/main.css: pending yellow, accepted green, declined / cancelled red, rescheduled blue
export const ORDER_STATUS_BADGE = {
  pending: 'status-pending',
  accepted: 'status-accepted',
  declined: 'status-declined',
  rescheduled: 'status-rescheduled',
  completed: 'bg-secondary status-completed',
  cancelled: 'status-cancelled',
}
