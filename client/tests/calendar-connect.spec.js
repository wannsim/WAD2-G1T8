// E2E: the shared Google Calendar box on the seller's two pages (calendar page and Order dashboard).
// SAFE: only paths that change NO data - open the password box, a WRONG password, Cancel. It never reaches Google
// (Google's own page cannot be automated, and connecting would change a real account).
// Start the app first (pnpm dev in client/ and server/), then:  cd client && npx playwright test tests/calendar-connect.spec.js
// Accounts come from client/.env.e2e (git-ignored): E2E_SELLER_EMAIL, E2E_SELLER_PASSWORD.
import { test, expect } from '@playwright/test'

// copied from tests/orders.spec.js: stop with a clear message if a variable is missing (the value is never printed)
function account(name) {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is missing - add it to client/.env.e2e`)
  return value
}

// copied from tests/orders.spec.js: log in and wait until the app has really left /login
async function logIn(page, email, password) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Log in', exact: true }).click()
  await expect(page).not.toHaveURL(/\/login/)
}

// The same steps on every page; only the address and the test id prefix change.
async function checkSafeConnectPaths(page, path, prefix) {
  await page.goto(path)
  const status = page.getByTestId(`${prefix}-status`)
  // the box only shows when Google Calendar is set up on this server; give the page time to load the status
  try {
    await status.waitFor({ timeout: 10000 })
  } catch {
    test.skip(true, 'Google Calendar is not set up on this server, so the box is hidden')
  }
  test.skip(await page.getByTestId(`${prefix}-disconnect`).isVisible(), 'This test account is already connected - disconnect it by hand first')

  // opening the box: the password field starts EMPTY and Continue waits for a password
  await page.getByTestId(`${prefix}-connect`).click()
  await expect(page.getByTestId(`${prefix}-password-box`)).toBeVisible()
  await expect(page.getByTestId(`${prefix}-password`)).toHaveValue('')
  await expect(page.getByTestId(`${prefix}-password-continue`)).toBeDisabled()

  // a wrong password: the server's message shows, the field is cleared, and the user is NOT logged out
  await page.getByTestId(`${prefix}-password`).fill('wrong-password-e2e')
  await page.getByTestId(`${prefix}-password-continue`).click()
  await expect(page.getByTestId(`${prefix}-connect-error`)).toHaveText('Wrong password. Please try again.')
  await expect(page.getByTestId(`${prefix}-password`)).toHaveValue('')
  await expect(page).toHaveURL(new RegExp(`${path}$`))

  // Cancel closes the box
  await page.getByTestId(`${prefix}-password-cancel`).click()
  await expect(page.getByTestId(`${prefix}-password-box`)).toHaveCount(0)
}

test.describe('TestSuite: Google Calendar box (safe paths only)', () => {
  test('Test1: seller, calendar page - empty password box, wrong password, still logged in, Cancel', async ({ page }) => {
    await logIn(page, account('E2E_SELLER_EMAIL'), account('E2E_SELLER_PASSWORD'))
    await checkSafeConnectPaths(page, '/seller/calendar', 'calendar-page')
  })

  test('Test2: seller, Order dashboard - the same steps', async ({ page }) => {
    await logIn(page, account('E2E_SELLER_EMAIL'), account('E2E_SELLER_PASSWORD'))
    await checkSafeConnectPaths(page, '/seller/orders', 'calendar')
  })
})
