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
4. **Install the front end** (in a second terminal):
   ```bash
   cd client
   pnpm install
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
   Do **not** run `pnpm seed` on a shared database - it deletes everything first.

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

All sample accounts use the password **`password123`**.

| Role | Email | What to try |
|---|---|---|
| Buyer | `alice@mock.test` | Has orders in every status, favourites, follows and chats - the best account for a demo |
| Buyer | `ben@mock.test`, `chloe@mock.test` | Orders, reviews and chats |
| Buyer | `farah@mock.test`, `gabriel@mock.test`, `hannah@mock.test`, `irfan@mock.test` | Orders and reviews with the newer shops |
| Buyer | `daniel@mock.test` | Brand-new buyer with no interests (tests recommendations for new users) |
| Seller | `bob@mock.test` (Bob's Bakes) | Orders waiting for a reply, reviews, analytics |
| Seller | `cara`, `dinesh`, `ella`, `farid`, `grace`, `hari`, `ivy`, `mei`, `jason`, `aisyah`, `kelvin`, `priya`, `rachel` `@mock.test` | One shop each |
| Buyer | `alice@test.com` | Older sample account (from `pnpm seed`) |
| Seller | `bob@test.com`, `cara@test.com` | Older sample accounts (from `pnpm seed`) |

After `pnpm activity` there are also `sam.search`, `cleo.clicks`, `fiona.follows`, `max.mixed` and
`nina.new` `@mock.test` (buyers whose activity each tests one part of the recommendations).

You can also register a new buyer or seller account on the **Create an account** page.

## 4. Test the application

### Automated tests

| Command | Where | What it checks | Needs |
|---|---|---|---|
| `pnpm test` | `client/` | Display helpers: prices, "3 days ago", capitalisation, Singapore time, MRT names (6 tests) | Nothing |
| `pnpm test` | `server/` | YouTube trend maths with a fake YouTube: keyword matching, music videos ignored, growth (5 tests); Gemini filter with a fake Gemini: keeps only relevant videos, falls back safely when there is no key, an error or no free quota left (5 tests) | Nothing (no key, no database) |
| `pnpm test:api` | `server/` | The running back end end-to-end: browse, search, product page, map, Trending feed, login (7 checks) | Back end running (`pnpm dev`) with sample data. **Read-only** - changes no data |

Expected result: every line says `PASS` / `pass`, ending with `ALL PASSED` or `fail 0`.

### Manual test cases

Run the app (section 2), then follow each case. Log in as the account shown.

| # | Feature | Steps | Expected result |
|---|---|---|---|
| 1 | Index page | Open http://localhost:5173 | Home page ("For you") loads with a sidebar, banners and product rows |
| 2 | Register + login | Create an account -> log out -> log in with it; then try a wrong password | New account logs in; wrong password shows an error |
| 3 | Browse & search | **Browse** -> search `kueh` -> choose a category -> set Max $ `10` | Only matching products, all within the price |
| 4 | Product page | Click any product card | Photos, price, slots, the seller box (ratings, response time, followers) and all reviews with star filters |
| 5 | Favourites | `alice@mock.test`: tap ♥ on a product -> open **Favourites** | Heart turns red at once; product appears in Favourites; tap again to remove |
| 6 | Follow a shop | On a product page click **+ Follow** -> **For you** -> **Following** tab | Button changes to "✓ Following"; that shop's products appear in Following |
| 7 | Order (delivery) | `alice@mock.test`: product from Bob's Bakes -> **Request order** -> pick a slot -> **Delivery** | Address is filled in from the profile; request is sent; it appears under **My orders -> Pending** |
| 8 | Seller replies | `bob@mock.test`: **Shop orders** -> **Accept** (or Decline / Propose new time) | Order moves to the right tab; the buyer gets a notification (bell) |
| 9 | Live chat | Two browsers: `alice@mock.test` and `bob@mock.test`. Alice opens a product -> **Chat with seller** -> sends a message | Bob sees it without refreshing, with a red unread badge on **Chats** |
| 10 | Notifications | After case 8, as Alice click the bell | New notification with date and time; mark as read / delete works |
| 11 | Review | `ben@mock.test`: **My orders -> Completed** -> **Kueh Lapis** -> **Leave a review**, choose stars and tags | Review appears on the product page; seller is notified |
| 12 | Recommendations | `alice@mock.test`: hover "Why recommended?" on a card; ♥ a few items -> **Refresh** | Each card shows one reason; top 3 have gold/silver/bronze medals; the order updates after Refresh |
| 13 | Trending | **For you -> Trending** | Products ranked by this week's orders, saves and views (and YouTube, if a key is set) |
| 13b | AI filter on YouTube results | With `YOUTUBE_API_KEY` and `GEMINI_API_KEY` set, start the back end and watch its terminal | `Trends: Gemini filter ON`, then for each keyword a `[Gemini] "keyword" ... kept X of Y` line with `KEEP` / `DROP` next to every video title |
| 14 | Map | **Shops near you** -> click a shop in the list | Map moves to its nearest MRT; pop-up shows category, rating and **View shop** |
| 15 | Seller analytics | `bob@mock.test`: **Analytics** -> choose 7 / 30 / 90 days | Revenue, completed orders, sales trend and top products for that period |
| 16 | My shop & listings | `bob@mock.test`: **Add products** -> add a product with a photo -> **My shop** | New product is listed; **Product reviews** section shows buyer reviews |
| 17 | Phone layout | Make the browser narrow (or use a phone) | Menu becomes a ☰ drawer, rows swipe sideways, no sideways page scrolling |

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

**Seller sales analytics** - **Analytics** (`/seller/analytics`) shows revenue, completed orders, units sold, average order value,
a sales trend, top products and counts by status for the last 7 / 30 / 90 days or a custom range (Singapore time).
Revenue counts **completed orders only**, using the total price saved on each order.

**Security note** - access to pages is checked in the browser using the logged-in user saved there;
the API does not yet verify a login token on every request.

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
