import Order from '../models/Order.js'
import Review from '../models/Review.js'
import Shop from '../models/Shop.js'

// Owner: Yu Chen
// Recalculates a shop's stats + trust score. Called after an order changes or a review is added.
// The FYP (Member 4) reads shop.stats.trustScore, so keep it between 0 and 100.
export async function updateShopStats(shopId) {
  const orders = await Order.find({ shop: shopId })
  const reviews = await Review.find({ shop: shopId })

  const total = orders.length
  const completed = orders.filter((o) => o.status === 'completed').length
  const declined = orders.filter((o) => o.status === 'declined').length
  const sellerCancelled = orders.filter((o) => o.status === 'cancelled' && o.cancelledBy === 'seller').length

  // fulfilment = of the orders the seller had to deal with, how many were completed
  const decided = completed + declined + sellerCancelled
  const fulfilmentRate = decided ? completed / decided : 0
  const cancellationRate = total ? sellerCancelled / total : 0

  const responded = orders.filter((o) => o.respondedAt)
  const avgResponseMins = responded.length
    ? responded.reduce((sum, o) => sum + (o.respondedAt - o.createdAt) / 60000, 0) / responded.length
    : 0

  const reviewCount = reviews.length
  const avgRating = reviewCount ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviewCount : 0

  // ---- trust score (0 - 100). TODO (Yu Chen): tune the weights ----
  let trustScore = 50 // brand-new shops start in the middle so they are not buried in the FYP
  if (total > 0 || reviewCount > 0) {
    const ratingPart = reviewCount ? avgRating / 5 : 0.6
    const speedPart = Math.max(0, 1 - avgResponseMins / 1440) // 0 if the seller takes 24h+ to reply
    trustScore = Math.round(
      100 * (0.4 * ratingPart + 0.3 * fulfilmentRate + 0.15 * (1 - cancellationRate) + 0.15 * speedPart)
    )
  }

  await Shop.findByIdAndUpdate(shopId, {
    $set: {
      'stats.avgRating': Math.round(avgRating * 10) / 10,
      'stats.reviewCount': reviewCount,
      'stats.fulfilmentRate': Math.round(fulfilmentRate * 100) / 100,
      'stats.cancellationRate': Math.round(cancellationRate * 100) / 100,
      'stats.avgResponseMins': Math.round(avgResponseMins),
      'stats.trustScore': trustScore,
    },
  })
}
