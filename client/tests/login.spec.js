// E2E: logging in (flows 1 and 2). Read-only - nothing is saved in the database.
// Start the app first (pnpm dev in client/ and server/), then:  cd client && pnpm test:e2e
// The account comes from client/.env.e2e (git-ignored). Google login cannot be automated, so it is not tested.
import { test, expect } from '@playwright/test'

// stop with a clear message if a variable is missing from client/.env.e2e (the value is never printed)
function account(name) {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is missing - add it to client/.env.e2e`)
  return value
}

test.describe('TestSuite: Login', () => {
  test('Test1: a buyer logs in with the right password and lands on "For you"', async ({ page }) => {
    // setup
    await page.goto('/login')

    // actions
    await page.getByLabel('Email').fill(account('E2E_BUYER_EMAIL'))
    await page.getByLabel('Password', { exact: true }).fill(account('E2E_BUYER_PASSWORD'))
    await page.getByRole('button', { name: 'Log in', exact: true }).click()

    // assert - login can take several seconds (the server checks the password), so wait up to 10 s
    await expect(page.getByRole('heading', { name: 'For you' })).toBeVisible({ timeout: 10000 })
  })

  test('Test2: a wrong password shows an error and stays on the login page', async ({ page }) => {
    // setup
    await page.goto('/login')

    // actions
    await page.getByLabel('Email').fill(account('E2E_BUYER_EMAIL'))
    await page.getByLabel('Password', { exact: true }).fill('not-the-right-password-123')
    await page.getByRole('button', { name: 'Log in', exact: true }).click()

    // assert
    await expect(page.getByText('Wrong email or password')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible()
  })
})
