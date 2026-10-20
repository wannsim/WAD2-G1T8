// Rules for a product listing, checked on create and edit so the data stays standard
// (category and price are used for filtering, search and sales analytics).
// Keep these lists the same as client/src/utils/constants.js
export const CATEGORIES = ['Baked goods', 'Meals', 'Snacks & desserts', 'Drinks', 'Handmade crafts', 'Others']
export const UNITS = ['piece', 'box', 'pack', 'set', 'dozen', 'slice', 'jar', 'bottle', 'kg', 'session', 'hour']

// up to 2 decimal places, e.g. 6, 6.5, 6.00
const PRICE_PATTERN = /^\d+(\.\d{1,2})?$/

// returns an error message, or '' if the listing is OK
export function checkProduct(body, { missingImage = false } = {}) {
  if (!body.name || !String(body.name).trim()) return 'Name is required.'
  if (!CATEGORIES.includes(body.category)) return 'Please pick a category from the list.'
  if (!body.description || !String(body.description).trim()) return 'Description is required.'
  if (!PRICE_PATTERN.test(String(body.price ?? '').trim())) return 'Price must be a number with at most 2 decimal places, e.g. 6.00'
  if (!UNITS.includes(body.unit)) return 'Please pick a unit from the list.'
  if (missingImage) return 'Please add at least one photo.'
  return ''
}

// "6" -> 6, "6.5" -> 6.5 (stored as a number, shown as $6.00 / $6.50)
export const toPrice = (price) => Math.round(Number(price) * 100) / 100

// "Gift, gift , keychain" -> ['gift', 'keychain']
export const cleanTags = (tags) => [...new Set((tags || []).map((t) => String(t).trim().toLowerCase()).filter(Boolean))]
