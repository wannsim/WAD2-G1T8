// Owner: Wan Sim
// Small safety rules shared by several routes, kept in one place so they stay the same everywhere.
// Pure functions (no database), tested in __tests__/safeInput.spec.js
//
// 1. Uploaded pictures: only these four types. SVG is left out on purpose: an SVG file can contain a script.
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024 // 5 MB
export const IMAGE_RULE_MESSAGE = 'Only JPEG, PNG, WebP or GIF images up to 5 MB are allowed'

// true for the four allowed types (capitals and spaces ignored)
export function isAllowedImageType(type) {
  return ALLOWED_IMAGE_TYPES.includes(String(type ?? '').trim().toLowerCase())
}

// a stored picture "data:image/png;base64,AAAA" -> { type: 'image/png', base64: 'AAAA' }
// null when the text is not a picture stored this way
export function readDataUrl(text) {
  const match = /^data:(.+?);base64,(.+)$/s.exec(String(text ?? ''))
  if (!match) return null
  return { type: match[1].trim().toLowerCase(), base64: match[2] }
}

// Sends a stored picture with its own type, or 404 when there is none or its type is not allowed.
// X-Content-Type-Options: nosniff tells the browser to trust that type and not guess another one
// (so a file can never be treated as a web page).
export function sendStoredImage(res, dataUrl, maxAgeSeconds) {
  const image = readDataUrl(dataUrl)
  if (!image || !isAllowedImageType(image.type)) return res.sendStatus(404)
  res.set('Content-Type', image.type)
  res.set('X-Content-Type-Options', 'nosniff')
  res.set('Cache-Control', `public, max-age=${maxAgeSeconds}`)
  return res.send(Buffer.from(image.base64, 'base64'))
}

// 2. Saving a form: copy ONLY the listed fields into a new object.
// Anything else in the body is left behind, e.g. "stats.trustScore", "$set", owner, followers.
export function pickFields(body, allowed) {
  const picked = {}
  if (!body || typeof body !== 'object') return picked
  for (const field of allowed) {
    if (body[field] !== undefined) picked[field] = body[field]
  }
  return picked
}

// the shop fields a seller may set (POST /shops and PUT /shops/:id). The name has its own rules in
// routes/shops.js; owner, stats, followers, pinned products and pictures are set by the server only.
export const SHOP_EDITABLE_FIELDS = [
  'description', 'address', 'nearestMrt', 'location', 'pickup', 'delivery', 'categories', 'experience', 'certifications',
]
