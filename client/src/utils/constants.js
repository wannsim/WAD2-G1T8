// Shared lists. If you add a category here, also add it to server/utils/productRules.js (the server checks it).
export const CATEGORIES = [
  'Baked goods',
  'Meals',
  'Snacks & desserts',
  'Drinks',
  'Handmade crafts',
  'Others',
]

// units a seller can sell by (price is "per unit")
export const UNITS = ['piece', 'box', 'pack', 'set', 'dozen', 'slice', 'jar', 'bottle', 'kg', 'session', 'hour']

// Bootstrap badge classes for each order status (used with :class="ORDER_STATUS_BADGE[order.status]")
export const ORDER_STATUS_BADGE = {
  pending: 'bg-warning text-dark',
  accepted: 'bg-success',
  declined: 'bg-danger',
  rescheduled: 'bg-info text-dark',
  completed: 'bg-secondary',
  cancelled: 'bg-dark',
}
