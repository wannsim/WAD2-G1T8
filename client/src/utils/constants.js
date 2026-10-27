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
