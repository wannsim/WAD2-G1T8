# Homly Hauls - IS216 Group Project (G1T8)

A one-stop platform for Singapore home businesses and their buyers: discover homemade food, crafts and
services near you, order and chat with sellers, and get personalised recommendations.

| | |
|---|---|
| **Git repository** | https://github.com/wannsim/WAD2-G1T8 |
| **Cloud URL** | Not hosted - the application runs locally (see below) |
| **First page (index)** | http://localhost:5173 - opens the home page ("For you") |

**Stack:** Vue 3 (Composition API) + Vue Router + Axios + Bootstrap 5 on the front end,
Express + Mongoose + MongoDB Atlas + Socket.IO on the back end.

```
WAD2-G1T8/
  client/   <- Vue app (front end)      pnpm dev  ->  http://localhost:5173   (index page = home page)
  server/   <- Express API (back end)   pnpm dev  ->  http://localhost:8000
```

---------------------------------------------------------------------

## 1. Set up the application

**Prerequisites:** [Node.js](https://nodejs.org) 22.12 or newer, and pnpm (`npm install -g pnpm`).

1. **Get the code** - unzip the submitted folder, or clone it:
   ```bash
   git clone https://github.com/wannsim/WAD2-G1T8.git
   cd WAD2-G1T8
   ```
2. **Install the back end:**
   ```bash
   cd server
   pnpm install
   ```
3. **Add the back-end settings.** If `server/config.env` was included in the submission, skip this step.
   Otherwise copy the example and fill it in:
   ```bash
   cp config.env.example config.env
   ```
   | Setting | Needed? | What it is |
   |---|---|---|
   | `DB` | **Required** | MongoDB connection string (MongoDB Atlas -> Connect -> Drivers) |
   | `GOOGLE_CLIENT_ID` | Optional | Google OAuth client ID - only for "Continue with Google" |
   | `YOUTUBE_API_KEY` | Optional | YouTube Data API v3 key - adds "trending on YouTube" to the Trending tab |
   | `GEMINI_API_KEY` | Optional | Free Gemini API key ([aistudio.google.com](https://aistudio.google.com) -> Get API key) - AI double-checks each YouTube result and drops videos that are not really about the product |
   | `PORT` | Optional | API port, default `8000` (the client expects 8000) |
   | `JWT_SECRET` | Optional | Any long random text used to sign login tokens. If empty, one is derived from `DB` |
   | `GOOGLE_CALENDAR_CLIENT_ID`, `GOOGLE_CALENDAR_CLIENT_SECRET`, `GOOGLE_CALENDAR_REDIRECT_URI` | Optional | Google OAuth client for sellers' "Connect Google Calendar". Redirect URI: `http://localhost:8000/calendar/callback`. If any of the three is missing, the Calendar box is hidden |
4. **Install the front end** (in a second terminal). The last line is only needed for the browser (E2E) tests:
   ```bash
   cd client
   pnpm install
   pnpm exec playwright install chromium
   ```
5. **Add the front-end setting (optional).** If `client/.env` was included, skip this. Otherwise
   `cp .env.example .env` and set `VITE_GOOGLE_CLIENT_ID` (same value as `GOOGLE_CLIENT_ID`).
   Without it, everything works except the Google sign-in button.
6. **Load the sample data** (only needed for an empty database - the team database already has it):
   ```bash
   cd server
   pnpm mock        # 14 shops, 74 products with photos, 12 buyers, orders, reviews, chats
   pnpm activity    # optional: extra buyers whose browsing shows how the recommendations work
   ```
   `pnpm mock` only replaces accounts ending in `@mock.test` (and anything linked to their shops).
   Do **not** run `pnpm seed` on a shared database - it deletes everything first. (On your own empty
   database, `pnpm seed` creates the `alice@test.com` / `bob@test.com` accounts listed in section 3.)
7. **Add the test accounts (only for the browser tests).** Create `client/.env.e2e` with the lines shown
   in section 3 (no quotes). This file is git-ignored.

## 2. Run the application

Open **two terminals** and keep both running:

```bash
# terminal 1 - back end
cd server
pnpm dev          # wait for "MongoDB connected" and "API running on http://localhost:8000"

# terminal 2 - front end
cd client
pnpm dev          # prints http://localhost:5173
```

Then open **http://localhost:5173** in a browser. The index page loads the home page (**For you**).
To try it on a phone on the same Wi-Fi, run `pnpm dev --host` in `client/` and open the "Network" address it prints.

## 3. Login details

All sample accounts use the password `password123`.

| Role | Email | Password | Created by |
|---|---|---|---|
| Buyer | `alice@test.com` | `password123` | Already in the team database (or `pnpm seed`) |
| Seller | `bob@test.com` | `password123` | Already in the team database (or `pnpm seed`) |
| Buyer | `alice@mock.test` | `password123` | `pnpm mock` |
| Seller | `bob@mock.test` | `password123` | `pnpm mock` |

**Browser-test accounts** - copy these lines into `client/.env.e2e`:

```
E2E_BUYER_EMAIL=alice@test.com
E2E_BUYER_PASSWORD=password123
E2E_SELLER_EMAIL=bob@test.com
E2E_SELLER_PASSWORD=password123
E2E_PRODUCT_ID=6ad567656a6201507854f92c
```

**Seller Google account** (for "Continue with Google"):

- Email: `wad2.homlyhauls@gmail.com`
- Password: `ArewegonnagetA?`

You can also register a new buyer or seller account on the **Create an account** page.

## 4. Test the application

Full details of every test file and test case are in [`TESTING.md`](TESTING.md).

### Step 1 - Unit, component and integration tests (no app, server or database needed)

```bash
cd client
pnpm test        # Vitest (unit, component, integration) + older node:test files

cd ../server
pnpm test        # Vitest (product rules, security helpers) + older node:test files (YouTube trends, Gemini filter)
```

| Where | Test files | What they check |
|---|---|---|
| `client/src/utils/__tests__/` | `format`, `geo`, `constants`, `mrtStations`, `shopStats`, `salesAnalytics`, `postalCode`, `forecast`, `makeNext` | Prices, dates in Singapore time, "3 days ago", distances, categories, MRT names, shop stats, sales date ranges, postal codes, the seller's order forecast and backtests, "What to make next" scoring |
| `client/src/components/__tests__/` | `StarRating`, `CategoryMultiSelect`, `MrtSelect`, `SearchBox`, `ForecastPanel`, `MakeNextPanel`, `ReviewBoard.integration` | Each component renders and reacts to clicks/typing; the forecast shows "Estimate" or "Not enough orders yet to forecast"; review list filters by star rating |
| `client/src/views/orders/__tests__/` | `GoogleCalendarConnect` | The seller's Google Calendar connect box |
| `client/tests/format.test.js` | `node:test` | Format helpers and MRT name cleaning |
| `server/utils/__tests__/productRules.spec.js` | Vitest | Product listing rules: name, category, price, photo, tags |
| `server/utils/__tests__/safeInput.spec.js` | Vitest | Security helpers: only JPEG / PNG / WebP / GIF pictures; only the allowed shop fields are saved |
| `server/tests/trends.test.js`, `geminiFilter.test.js` | `node:test` | YouTube trend maths and Gemini filter, with fake YouTube/Gemini (no keys needed) |

Expected result: Vitest ends with all tests `passed`, and `node:test` ends with `fail 0`.

### Step 2 - API smoke test (back end must be running)

```bash
cd server
pnpm dev          # terminal 1
pnpm test:api     # terminal 2 - browse, search, product page, map, Trending feed, login (7 checks)
```

Read-only - changes no data. Expected result: every line says `PASS`, ending with `ALL PASSED`.

### Step 3 - End-to-end browser tests (Playwright)

1. Make sure `client/.env.e2e` exists (setup step 7) and Chromium is installed (setup step 4).
2. Start the back end and front end (`pnpm dev` in `server/` and in `client/`), as in section 2.
3. In a third terminal:
   ```bash
   cd client
   pnpm exec playwright test tests/login.spec.js tests/browse.spec.js tests/calendar-connect.spec.js
   pnpm exec playwright show-report     # opens the HTML report
   ```

| Test file | Test cases | Changes data? |
|---|---|---|
| `tests/login.spec.js` | Buyer logs in and sees "For you"; wrong password shows "Wrong email or password" | No |
| `tests/browse.spec.js` | Buyer opens Browse, opens the first product, sees its name | No |
| `tests/calendar-connect.spec.js` | Seller opens the Google Calendar box on the calendar page and Order dashboard; empty and wrong password; Cancel (skipped if Calendar is not set up) | No |
| `tests/orders.spec.js` | Buyer orders the test product and sees "Order requested"; seller sees the pending order | **Yes - creates a real order** |

`pnpm test:e2e` runs all four files. Because `orders.spec.js` places a real order, only run it (or
`pnpm test:e2e`) against your own database. It also needs the test product to have orders open, pickup
enabled and a future pickup slot with space left.

### Manual test (quick check)

1. Log in as `alice@test.com` / `password123` -> the **For you** home page loads.
2. Go to **Browse**, open a product, place an order -> "Order requested" appears.
3. Log out, log in as `bob@test.com` / `password123` -> **Shop orders** shows the pending order.
4. Open **Chat** as either user and send a message -> it appears instantly for the other user.

---------------------------------------------------------------------

## External APIs

| API | Used for | Key? |
|---|---|---|
| **YouTube Data API v3** (`search.list`, `videos.list`) | The server checks how many people are watching videos about our sellers' products this week; rising keywords boost products on the **Trending** tab ("trending on YouTube"). Requests are asynchronous, cached in MongoDB and refreshed once a day | `YOUTUBE_API_KEY` (optional) |
| **Google Gemini API** (`generateContent`) | After each YouTube pull, Gemini reads the video titles and keeps only videos really about the product (e.g. drops a Minecraft "cookie farm" for *cookies*). Every decision is printed in the server terminal. Without a key, or when the free daily quota runs out, the word-match rules are used alone | `GEMINI_API_KEY` (optional, free) |
| **Google Identity Services** | "Continue with Google" sign-in | `GOOGLE_CLIENT_ID` (optional) |
| **Google Maps embed** | Map of each shop's nearest MRT station (iframe) | No key |

## Feature notes

**Seller product reviews** - **My shop** (`/seller/shop`) -> **Product reviews** lists buyer ratings and comments, newest first.
Filter by product or click **View reviews** on a listing; **Refresh reviews** fetches the latest.

**Seller sales analytics** - **Analytics** (`/seller/analytics`) shows revenue, completed orders, units sold, average order value, repeat customer rate,
a sales trend, top products and counts by status for the last 7 / 30 / 90 days or a custom range (Singapore time).
Revenue counts **completed orders only**, using the total price saved on each order.
Repeat customer rate is the percentage of unique buyers with a completed order placed in the selected period who have at least two completed orders placed by that period's end, including earlier purchases from the same shop. Each buyer counts once; orders without a buyer ID are excluded from this metric. No customers gives 0%. Like the other cards, the comparison shows percentage change relative to the preceding period; it is unavailable when either period has no customers or the previous rate is zero.

**Seller forecast** - on **Analytics**, switch from **Sales so far** to **Forecast** to see an estimate of
next weeks' orders (with a low-high range), the busiest weekdays and **What to make next**. It uses
completed orders only, and shows "Not enough orders yet to forecast" when there is too little history.
The maths and a worked example are in [`ALGORITHMS.md`](ALGORITHMS.md).

**Security note** - logging in returns a signed login token (`server/utils/auth.js`). The API checks it
on actions that change data (creating products, orders, reviews, avatars, Google Calendar), so a user can
only change their own account, shop and orders. Uploaded pictures must be JPEG, PNG, WebP or GIF, up to 5 MB.

## Project structure

### Client (`client/src/`) - what the user sees (Vue)
| Folder | Purpose |
|---|---|
| `assets/` | Global CSS (`main.css`) and shared page styles (`auth.css`) |
| `router/` | Maps each URL to a page (e.g. `/browse` -> BrowseView). One file per feature |
| `views/` | Full pages, grouped by feature (auth, seller, discover, orders, chat, feed...) |
| `components/` | Reusable pieces (NavBar sidebar, TopBar, ProductCard, StarRating...) |
| `utils/` | Shared helpers (API address, login state, formatting, socket connection) |

### Server (`server/`) - data and rules (Express + MongoDB)
| Folder | Purpose |
|---|---|
| `models/` | Blueprint for each MongoDB collection: the fields and their types |
| `routes/` | API endpoints the client calls (GET / POST / PUT / DELETE) and the logic behind each |
| `utils/` | Helpers: trust score, notifications, real-time updates, YouTube trends |
| `seed/` | Sample data scripts (`mock`, `activity`, `seed`) and product photos |
| `tests/` | Automated tests (`pnpm test`, `pnpm test:api`) |

## Credits

Photos for the sample products come from Wikimedia Commons under free licences - photographers and
licences are listed in [`server/seed/images/CREDITS.md`](server/seed/images/CREDITS.md).

## Use of AI tools

[To be completed by the team: state which AI tools were used, for which parts of the project, and how
the output was checked, as required by the IS216 project brief.]
