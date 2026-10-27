// Read-only check that a RUNNING backend works end to end (it never creates, changes or deletes data).
//   1. start the backend:   cd server && pnpm dev
//   2. in another terminal:  cd server && pnpm test:api
// Optional: API_URL=http://localhost:8000 (default)
const API = process.env.API_URL || 'http://localhost:8000'
let failed = 0

async function check(label, fn) {
  try {
    const detail = await fn()
    console.log(`PASS  ${label}${detail ? `  (${detail})` : ''}`)
  } catch (err) {
    failed++
    console.log(`FAIL  ${label}  -> ${err.message}`)
  }
}
const get = async (path) => {
  const res = await fetch(API + path)
  if (!res.ok) throw new Error(`${path} returned ${res.status}`)
  return res.json()
}
const assert = (ok, message) => { if (!ok) throw new Error(message) }

await check('Browse: GET /discover returns products', async () => {
  const data = await get('/discover')
  assert(Array.isArray(data.products) && data.products.length > 0, 'no products - run "pnpm mock" to add sample data')
  return `${data.products.length} products`
})

await check('Search: GET /discover?q=cake only returns matching products', async () => {
  const { products } = await get('/discover?q=cake')
  assert(products.every((p) => /cake/i.test(`${p.name} ${p.description} ${(p.tags || []).join(' ')}`)), 'a result does not match "cake"')
  return `${products.length} results`
})

await check('Product page: GET /products/:id returns one product with its shop', async () => {
  const { products } = await get('/discover')
  const p = await get(`/products/${products[0]._id}`)
  assert(p.name && p.shop && p.shop.name, 'product or shop missing')
  return p.name
})

await check('Map: GET /shops/map returns shops with a location', async () => {
  const shops = await get('/shops/map')
  const list = Array.isArray(shops) ? shops : shops.shops || []
  assert(list.length > 0, 'no shops')
  return `${list.length} shops`
})

await check('Trending tab: GET /feed/guest?tab=trending returns ranked products', async () => {
  const items = await get('/feed/guest?tab=trending')
  assert(Array.isArray(items) && items.length > 0 && items[0].product, 'empty feed')
  return `top: ${items[0].product.name} - "${items[0].reason}"`
})

await check('Login works with a sample account (alice@mock.test / password123)', async () => {
  const res = await fetch(`${API}/users/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'alice@mock.test', password: 'password123' }),
  })
  assert(res.ok, `login returned ${res.status} - run "pnpm mock" to create the sample accounts`)
  const user = await res.json()
  assert(user.role === 'buyer' && !user.password, 'wrong user data (or password hash sent back!)')
  return user.name
})

await check('Login rejects a wrong password', async () => {
  const res = await fetch(`${API}/users/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'alice@mock.test', password: 'wrong-password' }),
  })
  assert(res.status >= 400, `expected an error, got ${res.status}`)
  return `status ${res.status}`
})

console.log(failed ? `\n${failed} FAILED` : '\nALL PASSED')
process.exit(failed ? 1 : 0)
