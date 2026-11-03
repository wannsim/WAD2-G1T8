import { timeAgo, shortNumber, capitalize } from '@/utils/format'

// The six shop stats shown on the product page's seller box (ShopStrip) and the shop page's About tab.
//   shopStatItems(shop, productCount) -> [{ label: 'Ratings', value: '4.5 ★ (61)' }, ...]
// shop: needs stats, createdAt and followers (any shop from GET /shops/:id or a populated product.shop)

// avgResponseMins -> "Within 20 mins" / "Within 3 hours" / "Within days"
function responseTime(mins) {
  if (!mins) return 'New seller'
  if (mins < 60) return `Within ${Math.max(1, Math.round(mins))} mins`
  const hours = Math.round(mins / 60)
  if (mins < 1440) return `Within ${hours} ${hours === 1 ? 'hour' : 'hours'}`
  return 'Within days'
}

export function shopStatItems(shop, productCount = null) {
  const stats = shop?.stats || {}
  return [
    { label: 'Ratings', value: stats.reviewCount ? `${Number(stats.avgRating).toFixed(1)} ★ (${shortNumber(stats.reviewCount)})` : 'No ratings yet' },
    { label: 'Products', value: productCount === null ? '-' : String(productCount) },
    { label: 'Response time', value: responseTime(stats.avgResponseMins) },
    { label: 'Orders fulfilled', value: stats.fulfilmentRate ? `${Math.round(stats.fulfilmentRate * 100)}%` : '-' },
    { label: 'Joined', value: timeAgo(shop?.createdAt) || '-' },
    { label: 'Followers', value: shortNumber(stats.followerCount ?? shop?.followers?.length ?? 0) },
  ].map((item) => ({ ...item, value: capitalize(item.value) })) // every value starts with a capital letter
}
