import Product from '../models/Product.js'

// Product photos are stored as Base64 strings, which are huge.
// Instead of sending them inside the JSON, we send links (imageUrl / imageUrls) to
// GET /products/:id/image/:index so the browser can lazy-load and cache each photo.

// product: mongoose doc or plain object (query it with .select('-images') to keep it fast)
// imageCount: how many photos it has (see imageCounts) - used for the photo carousel on cards
export function withImageUrl(req, product, imageCount = 1) {
  const p = typeof product.toObject === 'function' ? product.toObject() : { ...product }
  delete p.images
  // ?v= changes when the product is edited, so the browser fetches the new photo
  const version = p.updatedAt ? new Date(p.updatedAt).getTime() : ''
  const base = `${req.protocol}://${req.get('host')}/products/${p._id}/image`
  p.imageUrl = `${base}/0?v=${version}`
  p.imageUrls = Array.from({ length: Math.max(imageCount, 1) }, (_, i) => `${base}/${i}?v=${version}`)
  return p
}

// Counts each product's photos inside the database without downloading them.
// returns Map(productId -> count)
export async function imageCounts(productIds) {
  const rows = await Product.aggregate([
    { $match: { _id: { $in: productIds } } },
    { $project: { count: { $size: { $ifNull: ['$images', []] } } } },
  ])
  return new Map(rows.map((r) => [String(r._id), r.count]))
}
