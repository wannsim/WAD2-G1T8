// E2E: a buyer places an order (flow 4), then the seller sees it (flow 5).
// WARNING: flow (4) creates a REAL order in the database in server/config.env every time it runs
// (and the seller gets a notification). Only run it against your own database.
// Start the app first (pnpm dev in client/ and server/), then:  cd client && npx playwright test tests/orders.spec.js
//
// Needs in client/.env.e2e (git-ignored): E2E_BUYER_EMAIL, E2E_BUYER_PASSWORD, E2E_SELLER_EMAIL,
// E2E_SELLER_PASSWORD, E2E_PRODUCT_ID. The product must belong to the E2E seller and have a free pickup slot.
import { test, expect } from '@playwright/test'

// stop with a clear message if a variable is missing from client/.env.e2e (the value is never printed)
function account(name) {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is missing - add it to client/.env.e2e`)
  return value
}

async function logIn(page, email, password) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Log in', exact: true }).click()
  // wait until the app has really left /login (it only does that after the server accepts the login).
  // Waiting for the "Log in" button to disappear was not enough: it turns into "Logging in..." straight away.
  await expect(page).not.toHaveURL(/\/login/)
}

// IMPORTANT: flow (5) depends on flow (4). (4) places the order and remembers the product name and
// pickup time; (5) looks for that order. 'serial' runs them in this order and skips (5) if (4) fails.
test.describe.configure({ mode: 'serial' })

let orderedProduct = '' // set by flow (4)
let orderedTime = ''    // set by flow (4), e.g. "20 Nov 2026, 3:00 pm"

test.describe('TestSuite: Ordering', () => {
  test('Test1 (flow 4): a buyer orders a product and sees "Order requested"', async ({ page }) => {
    // setup
    await logIn(page, account('E2E_BUYER_EMAIL'), account('E2E_BUYER_PASSWORD'))
    await page.goto(`/order/new/${account('E2E_PRODUCT_ID')}`)

    // wait for whichever the page shows: the order form, "no slots", "not available" or the load error
    const form = page.getByRole('heading', { name: /^Request:/ })
    const noSlots = page.getByText('No upcoming slots for this product.')
    const unavailable = page.getByText('This product is not available right now.')
    const loadError = page.getByText('We could not load this product. Please go back and try again.')
    await expect(form.or(noSlots).or(unavailable).or(loadError)).toBeVisible()
    if (await loadError.isVisible()) throw new Error('The order page could not load E2E_PRODUCT_ID - is the server running?')
    if (await unavailable.isVisible()) throw new Error('E2E_PRODUCT_ID: the seller has closed orders for this product. Reopen orders in My shop.')
    if (await noSlots.isVisible()) throw new Error('E2E_PRODUCT_ID has no open slots and the shop has no delivery. Add a pickup slot in My shop.')

    // pickup must be possible: if not, the page itself says why (e.g. "No pickup slots left...")
    const pickup = page.getByRole('radio', { name: /Pickup/ })
    if (await pickup.isDisabled()) {
      const why = await page.getByRole('group', { name: 'How would you like to get it?' }).innerText()
      throw new Error(`Pickup is not available for E2E_PRODUCT_ID, so this test cannot pick a slot. The page says: ${why.replace(/\s+/g, ' ')}`)
    }
    orderedProduct = (await form.innerText()).replace(/^Request:\s*/, '').trim()

    // actions
    await page.getByText('Pickup', { exact: true }).click() // the "Pickup" card (the radio inside it is hidden)
    await expect(pickup).toBeChecked()

    const time = page.getByLabel('Pickup time')
    const slots = time.getByRole('option').filter({ hasNotText: 'Please select one' })
    if ((await slots.count()) === 0) throw new Error('E2E_PRODUCT_ID has no pickup slot with space left. Add a slot in My shop.')
    orderedTime = (await slots.first().innerText()).trim()
    await time.selectOption({ label: orderedTime })

    await page.getByRole('button', { name: 'Send request' }).click()

    // assert - the celebration animation plays first (about 2 seconds); toBeVisible keeps checking until the
    // confirmation appears, so no sleep is needed. 10 s leaves room for the animation plus the server.
    await expect(page.getByRole('heading', { name: 'Order requested' })).toBeVisible({ timeout: 10000 })
    await expect(page.getByText(`${orderedProduct} × 1`)).toBeVisible()
  })

  // depends on flow (4): uses orderedProduct and orderedTime from the test above
  test('Test2 (flow 5): the seller sees that order under Shop orders', async ({ page }) => {
    // setup
    await logIn(page, account('E2E_SELLER_EMAIL'), account('E2E_SELLER_PASSWORD'))

    // actions
    await page.getByRole('link', { name: 'Shop orders' }).click()
    await expect(page.getByRole('heading', { name: 'Order dashboard' })).toBeVisible()
    await page.getByRole('tab', { name: /Needs reply/ }).click()
    await page.getByLabel('Search orders').fill(orderedProduct)

    // assert - a pending order for that product at that pickup time
    // (earlier runs may have booked the same slot, so there can be more than one match: first() is enough)
    const order = page.getByRole('article')
      .filter({ hasText: orderedProduct })
      .filter({ hasText: orderedTime })
      .first()
    await expect(order).toBeVisible()
    await expect(order.getByText('Pending', { exact: true })).toBeVisible()
  })
})
