import crypto from 'crypto'
import mongoose from 'mongoose'
import Shop from '../models/Shop.js'

// Who is making this request? The answer must come from the server, never from the browser.
//
// When someone logs in, the server hands back a TOKEN: "<data>.<signature>". The data says who they are
// and when the token expires; the signature is made with a secret only the server knows, so a browser
// cannot change the data (e.g. swap in someone else's id) without the signature no longer matching.
// The browser sends it on every request as   Authorization: Bearer <token>   (client/src/utils/http.js).
//
// Routes then use req.user.id (checked here) instead of a user id sent in the body or URL.
//   router.get('/x', requireAuth, ...)                 must be logged in
//   router.get('/x/:userId', requireSelf('userId'), ...) must be logged in AS that user
//   router.get('/shop/:shopId', requireShopOwner('shopId'), ...) must own that shop

const TOKEN_DAYS = 7

// The signing secret: JWT_SECRET in config.env, or (if a teammate hasn't added one) a secret derived
// from the database link, which only people with config.env have. Read on use, not on import,
// because config.env is loaded after the imports run.
function secret() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET
  return crypto.createHash('sha256').update(`homly-hauls-token:${process.env.DB || ''}`).digest('hex')
}

const sign = (data) => crypto.createHmac('sha256', secret()).update(data).digest('base64url')

export function createToken(user) {
  const payload = { id: String(user._id), role: user.role, exp: Date.now() + TOKEN_DAYS * 24 * 60 * 60 * 1000 }
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${data}.${sign(data)}`
}

// -> { id, role } or null (missing, changed or expired token)
export function readToken(token) {
  if (typeof token !== 'string') return null
  const [data, signature] = token.split('.')
  if (!data || !signature) return null
  const expected = Buffer.from(sign(data))
  const given = Buffer.from(signature)
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return null
  try {
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString())
    if (!mongoose.isValidObjectId(payload.id) || !(payload.exp > Date.now())) return null
    return { id: payload.id, role: payload.role }
  } catch {
    return null
  }
}

// app-wide: sets req.user from the Authorization header (null for guests). Never blocks on its own.
export function authenticate(req, res, next) {
  const header = req.headers.authorization || ''
  req.user = header.startsWith('Bearer ') ? readToken(header.slice(7)) : null
  next()
}

export function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ message: 'Please log in again.', error: 'Please log in again.' })
  next()
}

// the URL's user id must be the logged-in user
export function requireSelf(param) {
  return (req, res, next) => requireAuth(req, res, () => {
    if (String(req.params[param]) !== req.user.id) return res.status(403).json({ message: 'You can only see your own account.' })
    next()
  })
}

// the URL's shop must belong to the logged-in user
export function requireShopOwner(param) {
  return (req, res, next) => requireAuth(req, res, async () => {
    try {
      if (!mongoose.isValidObjectId(req.params[param])) return res.status(404).json({ message: 'Shop not found' })
      const shop = await Shop.findById(req.params[param]).select('owner').lean()
      if (!shop) return res.status(404).json({ message: 'Shop not found' })
      if (String(shop.owner) !== req.user.id) return res.status(403).json({ message: 'Only the shop owner can do this.' })
      next()
    } catch (err) {
      res.status(500).json({ message: err.message })
    }
  })
}
