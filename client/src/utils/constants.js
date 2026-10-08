// Shared lists. If you add a category here, tell the team (server/models/Product.js does not restrict it).
export const CATEGORIES = [
  'Baked goods',
  'Meals',
  'Snacks & desserts',
  'Drinks',
  'Handmade crafts',
  'Others',
]

// Bootstrap badge classes for each order status (used with :class="ORDER_STATUS_BADGE[order.status]")
export const ORDER_STATUS_BADGE = {
  pending: 'bg-warning text-dark',
  accepted: 'bg-success',
  declined: 'bg-danger',
  rescheduled: 'bg-info text-dark',
  completed: 'bg-secondary',
  cancelled: 'bg-dark',
}
