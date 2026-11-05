# Testing Homly Hauls

This project has four kinds of automated tests:

| Kind | Tool | Where the files are | Needs the app running? |
|---|---|---|---|
| Unit tests | Vitest | `client/src/utils/__tests__/`, `server/utils/__tests__/` | No |
| Component tests | Vitest + Vue Test Utils | `client/src/components/__tests__/`, `client/src/views/orders/__tests__/` | No |
| Integration test | Vitest + Vue Test Utils | `client/src/components/__tests__/ReviewBoard.integration.spec.js` | No |
| End-to-end (E2E) tests | Playwright (Chromium) | `client/tests/*.spec.js` | **Yes** |

There are also some older tests a teammate wrote with Node's built-in test runner (`node:test`).
They are in `client/tests/*.test.js` and `server/tests/*.test.js`, and `pnpm test` runs them too.

---

## 1. How to run the tests (Windows)

Open a terminal (PowerShell or Git Bash) in the project folder.

### Unit, component and integration tests

These don't need the app, the server or the database.

```
cd client
pnpm test
```

```
cd server
pnpm test
```

`pnpm test` runs `vitest run && pnpm test:node`. That is all the Vitest tests first, then the older `node:test` files.
If you only want one part:

```
pnpm exec vitest run                 # only the Vitest tests
pnpm test:node                       # only the older node:test files
pnpm exec vitest run src/components  # only the component and integration tests (client)
```

### E2E tests (Playwright)

1. Start the app yourself in **two** terminals and leave them running:
   ```
   cd server
   pnpm dev
   ```
   ```
   cd client
   pnpm dev
   ```
   The website must be on `http://localhost:5173` (the `baseURL` in `client/playwright.config.js`).
   The API must be on port 8000.
2. In a third terminal:
   ```
   cd client
   pnpm test:e2e                                               # every E2E test
   pnpm exec playwright test tests/login.spec.js --reporter=list  # only the login tests
   pnpm exec playwright test tests/orders.spec.js --reporter=list # only the order tests
   ```
3. After a run, `pnpm exec playwright show-report` opens the HTML report.

> **Warning: the order test creates a REAL order every time it runs.**
> `tests/orders.spec.js` places a real order in whatever database `server/config.env` points to.
> The test seller also gets a real notification.
> - **Only run it against your own database**, never the shared team database.
> - `pnpm test:e2e` includes this file. To avoid making an order, run only `tests/login.spec.js`.
> - Never run `pnpm seed` to "reset" for tests. It replaces the data in the database.

---

## 2. One-time setup for a new teammate

1. Install the packages:
   ```
   cd client
   pnpm install
   pnpm exec playwright install chromium
   ```
   ```
   cd server
   pnpm install
   ```
2. Create **`client/.env.e2e`** with these five lines, then fill in your own test accounts after the `=`:
   ```
   E2E_BUYER_EMAIL=
   E2E_BUYER_PASSWORD=
   E2E_SELLER_EMAIL=
   E2E_SELLER_PASSWORD=
   E2E_PRODUCT_ID=
   ```
   - Write values without quotes.
   - `E2E_PRODUCT_ID` is the id at the end of a product page's address (`/products/<id>`).
   - This file is git-ignored (see `client/.gitignore`). Check with `git check-ignore -v client/.env.e2e`.
   - **Don't put these in `client/.env`.** That file is already committed to git, so `.gitignore` does not protect it.
3. Set up the test seller's product (the one `E2E_PRODUCT_ID` points to):
   - It must belong to the `E2E_SELLER_EMAIL` account.
   - **Orders must be open.** In My shop, if it says "Orders closed", click **Reopen orders**.
   - The shop must offer **pickup**, and the product needs **at least one future pickup slot with space left**.
     Each order run uses up one place in a slot.

If something is missing, the test stops with a message that says what to fix. For example:
- "E2E_BUYER_EMAIL is missing - add it to client/.env.e2e"
- "the seller has closed orders for this product"
- "no pickup slot with space left"
- "is the server running?"

The message never prints the value.

---

## 3. Every test file

| File | Type | What it covers | Tests |
|---|---|---|---|
| `client/src/utils/__tests__/format.spec.js` | Unit | `formatPrice` (decimals, 0, missing); `formatDateTime` in Singapore time, including a UTC time that crosses midnight into the next day; `capitalize`; `timeAgo` (today, 1 day vs 5 days, the 30-day and 365-day boundaries, no date) | 11 |
| `client/src/utils/__tests__/geo.spec.js` | Unit | `distanceKm` (same point = 0, 1° of latitude ≈ 111.2 km, same both ways); `approximateLocation` rounds to 2 decimals | 4 |
| `client/src/utils/__tests__/constants.spec.js` | Unit | The category list (ends with "Others", no duplicates); `toCategory` (capitals, spaces, unknown, empty); `toCategories` removes duplicates | 6 |
| `client/src/utils/__tests__/mrtStations.spec.js` | Unit | `matchStation` ("bishan mrt" → "Bishan", extra spaces, made-up or partial names, empty); every station has at least one line | 5 |
| `client/src/utils/__tests__/shopStats.spec.js` | Unit | The six shop stats: values for a brand-new shop, rating text, response time in mins, hours or days, fulfilment % | 5 |
| `client/src/utils/__tests__/salesAnalytics.spec.js` | Unit | `validateSalesRange` (valid, start after end, impossible date); `percentChange` (normal, previous = 0); `previousSalesRange` | 6 |
| `client/src/utils/__tests__/postalCode.spec.js` | Unit (TDD) | `isValidPostalCode`: 6 digits OK; 5 or 7 digits, letters, symbols, empty or null refused; spaces around the code ignored | 5 |
| `client/src/utils/__tests__/forecast.spec.js` | Unit (TDD) | Seller forecast (see ALGORITHMS.md). `weeklyTotals` (7): Singapore weeks, empty weeks as 0, only completed orders, Sunday 17:30 UTC counts in the next week, pickup time first, this week left out. `forecastWeeks` (8): not enough history, the worked example (4, 6, 5, 7, 8, 9), flat, rising, a 0 week, never below 0. `busiestSlots` (7): per weekday, Saturday 17:30 UTC = Sunday, the 40% rule. `backtest` (4) and `rollingBacktest` (5) | 31 |
| `client/src/utils/__tests__/makeNext.spec.js` | Unit (TDD) | What to make next. `categoryGrowth` (4): last 4 full weeks vs the 4 before, 0 orders before (no divide by zero). `suggestNext` (10): 0.6 own + 0.4 trend with the reason, +100% cap, 2-order minimum, new category, shrinking category, other categories ignored, own growth only without trends, up to 3 keyword ideas, "baked goods" matches "Baked goods" | 14 |
| `server/utils/__tests__/productRules.spec.js` | Unit | `checkProduct` (complete listing, blank name, wrong category, price rules, missing photo); `toPrice`; `cleanTags` | 7 |
| `server/utils/__tests__/safeInput.spec.js` | Unit | Security helpers. `isAllowedImageType` (5): JPEG / PNG / WebP / GIF allowed, capitals ignored, SVG, HTML and missing types refused. `readDataUrl` (4): type and data read, normal links and empty values are not stored pictures. `pickFields` (6): only the listed shop fields are copied, `"stats.trustScore"` and `$set` are left behind, `false` and `''` kept, a new object, and the list has no server-only fields | 15 |
| `client/src/components/__tests__/StarRating.spec.js` | Component | Shows 5 stars; prop defaults; clicking a star when editable emits `rate` with 1, 3 or 5; clicking when display-only emits nothing | 5 |
| `client/src/components/__tests__/CategoryMultiSelect.spec.js` | Component | Placeholder and full list; ticking emits the new list; list stays in site order; × removes a chip; "Clear all" | 5 |
| `client/src/components/__tests__/MrtSelect.spec.js` | Component | Typing filters suggestions; "No station matches"; clicking a suggestion emits it; error for a made-up station after leaving the box; tidies "bishan mrt"; required message | 6 |
| `client/src/components/__tests__/SearchBox.spec.js` | Component | Placeholder prop and default; typing emits; × only shows after typing; × and Esc clear the search | 5 |
| `client/src/components/__tests__/ForecastPanel.spec.js` | Component | Mounted with an `orders` prop only (dates from "now"): too few orders shows "Not enough orders yet to forecast"; enough orders shows the "Estimate" badge and 4 estimate weeks; orders on one weekday show the busiest-weekday suggestion | 3 |
| `client/src/components/__tests__/MakeNextPanel.spec.js` | Component | Props only: the reason and "Ideas to explore (trending on YouTube)"; no trend data says "own orders only" and still suggests; nothing growing shows "No suggestions yet" | 3 |
| `client/src/views/orders/__tests__/GoogleCalendarConnect.spec.js` | Component (teammate: Basile) | The shared Google Calendar box, steps with no server call only: hidden while unavailable, not connected / connected states, the password box (empty, Continue enabled after typing, Cancel), Disconnect asks first | 8 |
| `client/src/components/__tests__/ReviewBoard.integration.spec.js` | Integration | Real `ReviewBoard` + real `StarRating`: total and average shown; one star rating per review; "5 Stars" filter leaves only 5-star reviews; "No reviews match this filter."; back to "All Ratings" | 4 |
| `client/tests/login.spec.js` | E2E | (1) buyer logs in and sees "For you"; (2) wrong password shows "Wrong email or password" | 2 |
| `client/tests/orders.spec.js` | E2E | (4) buyer orders the test product and sees "Order requested"; (5) seller sees that pending order in Shop orders. (5) depends on (4). **Creates a real order.** | 2 |
| `client/tests/browse.spec.js` | E2E | (3) the browse flow: buyer goes to Browse, opens the first product and sees its name on the product page | 1 |
| `client/tests/calendar-connect.spec.js` | E2E (teammate: Basile) | The Google Calendar box on the seller's calendar page and Order dashboard: empty password box, wrong password, still logged in, Cancel. Safe paths only: changes no data and never reaches Google | 2 |
| `client/tests/format.test.js` | Unit (older, `node:test`) | Teammate's tests for the format helpers and `cleanMrtName` | 6 |
| `server/tests/geminiFilter.test.js` | Unit (older, `node:test`) | Teammate's tests for the Gemini video filter | 5 |
| `server/tests/trends.test.js` | Unit (older, `node:test`) | Teammate's tests for the YouTube trend maths | 5 |

**Totals** (counted by running the tests on 5 Nov 2026, not by adding up):
- Vitest, client: **126 tests in 17 files**, all passing (87 unit, 35 component, 4 integration).
- Vitest, server: **22 tests in 2 files**, all passing (7 product rules, 15 security helpers).
- E2E: **7 tests in 4 files** (login 2, browse 1, orders 2, calendar-connect 2). Counted with `pnpm exec playwright test --list`, which lists them without running them, because running the order test creates a real order.
- Older `node:test`: **16** (client 6, server 10), all passing.

(`server/tests/api-smoke.mjs` is a teammate's separate script, run with `pnpm test:api`. It isn't part of `pnpm test`.)

---

## 4. Not tested, and why

| What | Why it has no test |
|---|---|
| `server/utils/trust.js` (trust score) | The maths sits inside `updateShopStats`, which reads and writes MongoDB. Testing it needs either mocking the database (outside the slides) or moving the maths into its own pure function, which means editing the owner's file. |
| `client/src/utils/auth.js` | The browser storage itself could be tested without mocking. But importing the file imports `socket.js`, which opens a live Socket.IO connection to the server right away, and a unit test shouldn't need the server. |
| `ProductCard` | It imports `FavouriteButton` → `auth.js` → `socket.js`, so mounting it opens a connection to the server. |
| `NotificationItem` | Same socket import, and clicking a notification calls the API (`markRead`). |
| `ReviewList` | It loads its reviews from the API when it mounts. `ReviewBoard`, the part that shows them, is tested instead. |
| `ShopCard` | It contains `FollowButton`, which calls the API. |
| `FollowButton` | It calls the API to follow or unfollow. |
| `FavouriteButton` | It loads and saves favourites through the API. |
| Google login | It runs in Google's own pop-up and needs a real Google account, so it can't be automated. |
| `server/routes/forecast.js` (`GET /forecast/make-next/:shopId`) | It reads products and saved YouTube trends from MongoDB. Testing it without a database means mocking MongoDB (outside the slides), and it must never write to the shared one. Checked by hand only: 401 without a login, 200 for the shop owner. The matching and scoring it feeds are in `makeNext.js`, which is tested. |
| `MakeNextSection.vue` | It only loads that route with axios and passes the data on, so testing it needs the server or a mocked axios. `MakeNextPanel`, which shows the data, is tested with props instead. |
| The security checks inside the routes (shop field copy in `POST`/`PUT /shops`, photo filters in `products.js` / `users.js` / `shops.js`, `type: 'order'` refused by `POST /feed/interactions`) | The routes read and write MongoDB, and the shared database must not be written to by tests. The helpers they use are tested (`safeInput.spec.js`). Checked by hand on a throwaway server with no database: an HTML file, an SVG and a 6 MB PNG to `/products` get 400 "Only JPEG, PNG, WebP or GIF images up to 5 MB are allowed"; an SVG avatar is refused; `type: 'order'` gets 400. A seller actually saving a shop with a `"stats.trustScore"` key was **not** run, because it writes to the database. |

---

## 5. Known limitations

- **The postal-code helper isn't used by the app.** `client/src/utils/postalCode.js` was written only to demonstrate TDD. The buyer profile page still has its own check (`/^\d{6}$/`). Switching it to the helper would mean editing a teammate's page, so it was left alone.
- **The integration test checks the parent re-rendering its children, not a child sending an event up.**
  - What it tests: when the user changes `ReviewBoard`'s rating filter, the parent passes new data down and the right `StarRating` children appear or disappear.
  - Why not events: `ReviewBoard` only uses `StarRating` to *display* stars, so the child never emits anything there.
  - Where events are tested: the child-to-parent `rate` event is covered in `StarRating.spec.js`.
- **Flow (5) can't tell this run's order apart from an older one in the same slot.** It looks for a pending order for that product at that pickup time. If an earlier run booked the same slot and that order is still pending, it also matches.
- **E2E runs on Chromium only,** so one run creates one order instead of three. Firefox and Safari (WebKit) aren't tested.
- **Each order run uses up one place in a pickup slot.** After enough runs the slots fill up, and the test then stops with "no pickup slot with space left". Add more slots in My shop, or cancel the test orders.
- **One worker, tests in order.** E2E tests run one at a time (`workers: 1`) because flow (5) needs flow (4) first.

---

## 6. Beyond the slides

Everything else uses only what the Week 10 slides teach. These extras were needed:

| Extra | Why it was used |
|---|---|
| `process.loadEnvFile` (Node 20.12+) | It reads the test accounts from `client/.env.e2e`. It's built into Node, so no extra library like `dotenv` is needed. |
| `toBeCloseTo` (Vitest) | Distances, forecasts and scores are decimals, so `toBe` would fail on tiny rounding differences. |
| `locator.or()` (Playwright) | The order page can show one of four things (the form, "no slots", "not available" or a load error). It waits for whichever appears, so the test can fail with a clear message instead of a timeout. |
| `filter({ hasText })` (Playwright) | It picks out the one order card that has both the right product name and the right pickup time. |
| `test.describe.configure({ mode: 'serial' })` | It runs flow (4) before flow (5), and skips (5) if (4) fails, because (5) looks for the order (4) made. |
| `toBeChecked()` | It confirms the "Pickup" option really got selected. Its radio button is visually hidden inside a card. |
| `toBeHidden()` | It was used at first to wait for the "Log in" button to disappear after logging in. That caused a timing bug (see `toHaveURL`), so it was replaced and is no longer in any test. |
| `toHaveURL()` | It waits until the app has really left `/login` after logging in. Waiting for the "Log in" button to disappear wasn't enough, because it changes to "Logging in…" straight away. |

---

## 7. Notes for the report

### Unit vs integration vs E2E (examples from Homly Hauls)

- **Unit test:** tests one small piece of code by itself, with no browser, server or database.
  - Example: `checkProduct` in `productRules.spec.js` checks that a price of `6.555` is refused.
  - Example: `formatDateTime` in `format.spec.js` checks that 17:30 UTC shows as 1:30 am the *next* day in Singapore.
  - They run in about a second, so they can run after every change.
- **Component test:** a unit test for one Vue component, mounted on its own.
  - Example: `StarRating.spec.js` clicks the 3rd star and checks that the component emits `rate` with `3`.
- **Integration test:** checks that real pieces work together.
  - Example: `ReviewBoard.integration.spec.js` mounts the real `ReviewBoard` with its real `StarRating` children.
  - When the user picks "5 Stars", only the 5-star reviews remain and their star ratings re-render to match.
- **E2E test:** uses the whole app like a real user, in a real browser, against the real server and database.
  - Example: `orders.spec.js` logs in as a buyer, picks a pickup slot, clicks "Send request" and sees "Order requested".
  - Then it logs in as the seller and finds that order in Shop orders.
  - It's the slowest and needs the most setup, but it's the closest to real use.

### Verification vs validation

- **Verification: "did we build it right?"** Does the code do what the spec says?
  - Example: the spec says a price can have at most 2 decimal places.
  - `productRules.spec.js` checks that `6.50` passes and `6.555` is refused.
- **Validation: "did we build the right thing?"** Does it actually meet the users' needs?
  - Example of how it could be done: ask a few people who run (or would run) a home business to set up their pickup slots in My shop, and ask a few buyers to order something.
  - Then check whether they can do it without help, and whether the words they see make sense to them ("Orders closed", "Needs reply", "Waiting on buyer").
  - The tests can pass even if real users find a feature confusing. Only people using the app can show whether it is the right thing.

### Regression testing

A regression is when a change breaks something that used to work. To catch it early:
- **Run `pnpm test` in `client/` and `server/` after every change,** before committing. It takes a few seconds and needs nothing running.
- Run the E2E login tests before a demo or a merge. Run the order test only on your own database.
- Example of a regression these tests would catch: if someone renamed a category in `constants.js` and dropped "Others", `constants.spec.js` would fail at once, before the shop and Browse filters broke.

### How TDD was used: the postal-code helper

TDD means **Red → Green → Refactor**: write a failing test first, then the least code that passes, then tidy up.

1. **Red (step 1):** `postalCode.spec.js` was written first, before `postalCode.js` existed. The run failed because the file couldn't be found.
2. **Red (step 2):** an empty `isValidPostalCode` that always returns `false` was added, so the tests ran and failed on their checks:
   `× Test1: accepts a 6-digit postal code`, `× Test5: ignores spaces …`, giving **"Tests 2 failed | 3 passed (5)"**.
3. **Green:** the least code to pass was a null check plus `/^\d{6}$/.test(code.trim())`, giving **"Tests 5 passed (5)"**.
4. **Refactor:** the code was shrunk to one line (`String(code ?? '').trim()`) with a comment. The tests were run again: still **"Tests 5 passed (5)"**.

Writing the tests first made the edge cases clear before any code existed: 5 or 7 digits, the letter O instead of zero, `null`, and spaces.

### Load-testing plan (described only, not run)

Tool: **k6** (a JavaScript script) or **JMeter**. Run it against a **separate copy of the database**, never the shared one and never your E2E one, because the order step creates real orders.

| What to test | Request | Why |
|---|---|---|
| Browse page | `GET /discover` (with and without a search word) | The most-visited page; it searches every product |
| Product page | `GET /products/:id` and `GET /orders/open-slots/:id` | Opened every time someone clicks a product |
| Log in | `POST /users/login` | bcrypt password checks are slow on purpose |
| Place an order | `POST /orders` | It writes to the database and checks slot capacity, so it matters when many buyers want the same slot |

**Virtual users (VUs):**
1. Warm-up: 10 VUs for 1 minute.
2. Normal load: ramp up to **50 VUs** over 2 minutes and hold for 5 minutes. That's about a busy evening for a small marketplace.
3. Stress: ramp up to **200 VUs** for 2 minutes, to find where it starts to slow down.

Each VU waits 1–3 seconds between steps, like a real person.

**What counts as acceptable:**
- Browse, product page and login: **95% of requests under 500 ms**.
- Placing an order: **95% under 1 second**.
- Fewer than **1% failed requests** (errors or timeouts).
- No slot gets more orders than its capacity, even when many buyers order the same slot at once.

---

## 8. Bug found while testing

**Price rule accepts $0 (found, not yet reported)**

- **File:** `server/utils/productRules.js`, line 34: `const PRICE_PATTERN = /^\d+(\.\d{1,2})?$/`
- **What happens:** `checkProduct` accepts a price of `0` or `0.00`, so a seller can list a product for $0.
- **Why it matters:** a free listing is probably a typing mistake, and it would show as "$0.00" in Browse and in order totals.
- **Status:** found, not yet reported. Changing it means editing a teammate's file, which needs their approval. No test asserts the current behaviour, so fixing it won't break any test.
