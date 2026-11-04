// E2E: a buyer browses and opens a product (flow 3). Read-only - nothing is saved in the database.
// Start the app first (pnpm dev in client/ and server/), then:  cd client && npx playwright test tests/browse.spec.js
// The account comes from client/.env.e2e (git-ignored). The product is whichever one Browse shows first.
import { test, expect } from '@playwright/test'

// stop with a clear message if a variable is missing from client/.env.e2e (the value is never printed)
function account(name) {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is missing - add it to client/.env.e2e`)
  return value
}

test.describe('TestSuite: Browse', () => {
  test('Test1: a buyer opens a product from Browse', async ({ page }) => {
    // setup
    await page.goto('/login')
    await page.getByLabel('Email').fill(account('E2E_BUYER_EMAIL'))
    await page.getByLabel('Password', { exact: true }).fill(account('E2E_BUYER_PASSWORD'))
    await page.getByRole('button', { name: 'Log in', exact: true }).click()
    // login can take several seconds (the server checks the password), so wait up to 10 s
    await expect(page.getByRole('heading', { name: 'For you' })).toBeVisible({ timeout: 10000 })

    // actions
    await page.getByRole('link', { name: 'Browse', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Browse' })).toBeVisible()

    // every product card's first photo is called "<product name> photo 1", so the first one gives the name
    const firstPhoto = page.getByRole('img', { name: / photo 1$/ }).first()
    await expect(firstPhoto).toBeVisible()
    const productName = (await firstPhoto.getAttribute('alt')).replace(/ photo 1$/, '')

    await page.getByRole('link', { name: productName, exact: true }).first().click()

    // assert
    await expect(page).toHaveURL(/\/products\//)
    await expect(page.getByRole('heading', { name: productName, exact: true })).toBeVisible()
  })
})
