// Product photos are stored as Base64 strings, which are huge.
// Instead of sending them inside the JSON, we send a link (imageUrl) to
// GET /products/:id/image/0 so the browser can lazy-load and cache each photo.

// product: mongoose doc or plain object (query it with .select('-images') to keep it fast)
export function withImageUrl(req, product) {
  const p = typeof product.toObject === 'function' ? product.toObject() : { ...product }
  delete p.images
  // ?v= changes when the product is edited, so the browser fetches the new photo
  const version = p.updatedAt ? new Date(p.updatedAt).getTime() : ''
  p.imageUrl = `${req.protocol}://${req.get('host')}/products/${p._id}/image/0?v=${version}`
  return p
}
