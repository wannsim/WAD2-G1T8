# Algorithms in Homly Hauls

This file explains the logic behind the seller **Forecast and what to make next** feature (new), and the existing
**For You** feed and **Trending** tab. It only describes code that exists. Numbers marked "made-up" are examples
for explaining; numbers marked "real" come from the test seller's shop in my own database (read only, 5 Nov 2026).

---

## The business problem

Home sellers don't know how many orders to expect or when, or what to make next, so they set slot capacity and
stock by guessing. This feature helps them plan.

| Problem | Feature | How it works (one line) | Evidence |
|---|---|---|---|
| "How many orders will I get?" | **Forecast** (next 4 weeks) | Recent level (weighted average of the last 4 weeks) + trend line, with a low–high range | Backtest on the test seller: lost the most recent month, won over 10 rolling cut-offs (see [Evidence](#4-evidence-backtests)) |
| "Which days should get more slots?" | **Busiest weekdays** | Completed orders per weekday; only names days when the top 2 have at least 40% | Test seller: orders are spread evenly (top 2 days = 33%), so it says so instead of naming days |
| "What should I make next?" | **What to make next** | Score = 0.6 × own category growth + 0.4 × rising YouTube keyword, with the reason shown | Test seller: "Orders for Baked goods grew 61% and 'loaf' is trending" (score 77/100) |

Where it is: the seller's **Analytics** page. Click **Forecast** in the "Sales so far / Forecast" toggle next to the
title to see the "Forecast" and "What to make next" panels.

All three use **completed orders only** (pending, accepted, declined, rescheduled and cancelled are ignored), grouped by
the **pickup/delivery date** (`requestedTime`, or the order date if it is missing) in **Singapore time**. Dates are
saved in UTC, so 8 hours are added before taking the day: an order at 17:30 UTC on Sunday counts as Monday 01:30.
Weeks run Monday to Sunday. The current week is left out until it ends, because half a week would look like a drop.

---

## 1. Forecast: the next 4 weeks

**Code:** `client/src/utils/forecast.js` (`weeklyTotals`, `forecastWeeks`) · **Shown by:** `ForecastPanel.vue` ·
**Tests:** `forecast.spec.js`, `ForecastPanel.spec.js`

### Method in plain words

1. **Count completed orders per week** (`weeklyTotals`), from the week of the first completed order up to last week.
   Weeks with no orders count as 0.
2. **Recent level** – a weighted moving average of the last 4 weeks. The newest week counts 4 times as much as the
   oldest:
   `level = (1 × oldest + 2 × next + 3 × next + 4 × newest) / 10`
3. **Trend** – a least-squares straight line through up to the last 12 weeks. Its slope is how many orders per week
   the shop gains (or loses):
   `slope = Σ (week − average week) × (orders − average orders) / Σ (week − average week)²`
4. **Estimate** for the week *h* weeks after last week:
   `expected = level + slope × (h + 1)`, never below 0.
   Why "+ 1": a weighted average sits about one week behind the newest week (with weights 1, 2, 3, 4 its centre is
   week 3 of 4), so we add one more week of trend to catch up.
5. **Range** – how far past weeks typically were from the trend line:
   `spread = √( Σ (orders − line)² / (weeks − 2) )`, then `low = expected − spread × √h`, `high = expected + spread × √h`.
   We divide by *weeks − 2* because the line was fitted to those same weeks (2 numbers: slope and starting point), so it
   fits them better than it will fit the future. `√h` makes the range wider the further ahead it looks.
   **The range is a typical spread of past misses, not a guarantee.** A holiday, a festival week or a quiet week can
   land outside it.
6. **Not enough data** – fewer than 4 full weeks or fewer than 10 completed orders shows
   "Not enough orders yet to forecast" instead of a number.

The page rounds the estimate to a whole number and rounds the range outwards (low down, high up).

### Why these numbers

| Setting | Value | Why |
|---|---|---|
| Weights of the last 4 weeks | 1, 2, 3, 4 | Recent weeks say more about next week than older ones, but one odd week shouldn't decide everything. |
| Weeks used for the trend line | at most 12 | About 3 months: long enough to see a direction, short enough that very old habits don't steer it. |
| Minimum history | 4 weeks and 10 orders | With less, the average and the line are mostly noise. |
| Range | ± spread × √h | Uncertainty adds up week by week; √ is the usual way independent misses add up. |

No weekday seasonality is used: the Busiest weekdays panel answers "which days", and with this little data a
per-weekday adjustment would mostly fit noise.

### Worked example (made-up: 4, 6, 5, 7, 8, 9 orders)

| Week | 1 | 2 | 3 | 4 | 5 | 6 |
|---|---|---|---|---|---|---|
| Orders | 4 | 6 | 5 | 7 | 8 | 9 |

39 orders over 6 weeks, so there is enough history.

1. **Level** = (1×5 + 2×7 + 3×8 + 4×9) / 10 = 79 / 10 = **7.9**
2. **Slope**: average week 3.5, average orders 6.5. Σ(x−x̄)(y−ȳ) = 16.5, Σ(x−x̄)² = 17.5, so slope = **0.94** orders per week.
   The line is `orders = 3.2 + 0.94 × week`.
3. **Week 7** (h = 1): 7.9 + 0.94 × 2 = **9.8** (the line alone also gives 3.2 + 0.94 × 7 = 9.8).
4. **Spread**: the misses from the line are −0.14, 0.91, −1.03, 0.03, 0.09, 0.14. Squared and added: 1.94.
   1.94 / (6 − 2) = 0.49, √0.49 = **0.70**.
5. **Week 7 range**: 9.8 ± 0.70 = **9.1 to 10.5** → the page shows "about 10 (9–11)".
   **Week 8** (h = 2): 7.9 + 0.94 × 3 = **10.7**, ± 0.70 × √2 = ± 0.99 → **9.7 to 11.7**.

This example is a test (`forecast.spec.js`, "Test4: the worked example").

### Real: the test seller (5 Nov 2026)

17 full weeks (6 Jul – 26 Oct) with 4, 4, 5, 4, 5, 4, 5, 5, 6, 5, 6, 5, 7, 8, 8, 9, 13 completed orders.

| Week starting | Estimate | Range |
|---|---|---|
| 2 Nov | about 11 | 10–13 |
| 9 Nov | about 12 | 10–14 |
| 16 Nov | about 13 | 10–15 |
| 23 Nov | about 13 | 10–16 |

---

## 2. Busiest weekdays (the 40% rule)

**Code:** `forecast.js` (`busiestSlots`) · **Shown by:** `ForecastPanel.vue` · **Tests:** `forecast.spec.js`

### Method in plain words

1. Count completed orders per weekday (Monday to Sunday), by the weekday of the pickup/delivery time in Singapore time.
2. Take the 2 busiest days (a tie goes to the day with more revenue, then to the earlier day).
3. **Only name them if they really stand out:**
   `share = orders on the top 2 days / all completed orders`
   - share ≥ 40% → "Add more slot capacity on Saturdays and Sundays (70% of your completed orders)."
   - share < 40% → "Your orders are spread fairly evenly across the week."
4. Under 10 completed orders there is no suggestion yet.

### Why 40%

If orders were spread evenly, any 2 of the 7 days would have 2/7 ≈ **29%**. 40% means the top 2 days get clearly more
than their fair share. Without this rule, the test seller would have been told to add capacity on Saturdays and
Thursdays with only 33%, which is hardly more than even.

### Worked example (made-up)

10 orders: 4 on Saturdays, 3 on Sundays, 2 on Wednesdays, 1 on a Monday. Top 2 = Saturday + Sunday = 7 of 10 = 70%
→ "Add more slot capacity on Saturdays and Sundays (70% of your completed orders)." (a test in `forecast.spec.js`)

### Real: the test seller

Mon 12, Tue 15, Wed 14, Thu 16, Fri 15, Sat 18, Sun 14 (104 completed orders). Top 2 = Sat + Thu = 34 of 104 = 33%
→ "Your orders are spread fairly evenly across the week."

---

## 3. What to make next (the 60/40 score)

**Code:** `client/src/utils/makeNext.js` (`categoryGrowth`, `suggestNext`) · **Data:** `server/routes/forecast.js`
(`GET /forecast/make-next/:shopId`) · **Shown by:** `MakeNextPanel.vue` (loaded by `MakeNextSection.vue`) ·
**Tests:** `makeNext.spec.js`, `MakeNextPanel.spec.js`

### Method in plain words

For each category the seller sells:

1. **Own growth** – completed orders in the **last 4 full weeks** compared with the **4 weeks before**:
   `growth = (recent − before) / before`, e.g. 5 → 7 orders = +40%.
   - **Own score** (0 to 1) = the growth, with +100% or more counting as 1 and shrinking counting as 0.
   - A category needs **at least 2 recent orders** to count (1 → 2 orders is "+100%" but says nothing yet).
   - **0 orders before** would mean dividing by zero. Instead the category is marked **new**: if it has at least
     2 recent orders it gets the full own score (1), and the reason says "are new (3 in the last 4 weeks, none before)".
2. **Trend** – the server sends the rising YouTube keywords (from the existing Trending feature, `trends.js`) that
   appear in products' names and tags, with each product's category. The page keeps the ones in the seller's
   categories, ignoring capitals (`toCategory`, so "baked goods" matches "Baked goods").
   - **Trend score** (0 to 1) = the growth of the **best** rising keyword, with +100% or more counting as 1.
3. **Score** = `0.6 × own score + 0.4 × trend score`.
4. Show the **top 3** categories with a score above 0, each with its reason in plain words, and up to 3 rising
   keywords as "Ideas to explore (trending on YouTube)". Only the best keyword counts in the score.
5. **No trend data** (no YouTube key, or not refreshed yet) → the trend score is 0 for everyone, so the ranking is by
   own growth only, and the panel says "these suggestions use your own orders only".

### Why 60/40

The seller's own orders are real buyers of **this** shop; a YouTube trend is general interest in Singapore. So own
growth counts more. With 60/40, a trend can lift a slowly growing category above a flat one, but a trend alone (at most
0.4) can never beat a category whose own orders doubled (0.6). Growth is capped at +100% so one huge jump (2 → 20
orders, or a keyword at +1000%) can't drown out everything else.

### Worked example (made-up)

Cakes & cupcakes: 5 orders in the 4 weeks before, 7 in the last 4 weeks → +40%, own score 0.4.
Best rising keyword in that category: "pandan cake" +35%, trend score 0.35.
Score = 0.6 × 0.4 + 0.4 × 0.35 = 0.24 + 0.14 = **0.38** → shown as "Score 38 / 100" with the reason
"Orders for Cakes & cupcakes grew 40% and 'pandan cake' is trending". (a test in `makeNext.spec.js`)

### Real: the test seller

The shop has 9 products, all in **Baked goods**. Baked goods: 23 → 37 completed orders (+61%, own score 0.61).
Best rising keyword in Baked goods: "loaf" +246% (trend score capped at 1).
Score = 0.6 × 0.61 + 0.4 × 1 = **0.77** → "Orders for Baked goods grew 61% and 'loaf' is trending".
Ideas to explore: loaf +246%, cookie monster special +233%, pastry +157%.
Because the shop sells only one category, it gets only one suggestion (see Known limitations).

---

## 4. Evidence: backtests

**Code:** `forecast.js` (`backtest`, `rollingBacktest`) · **Tests:** `forecast.spec.js`

A backtest asks: "if we had used this method in the past, how close would it have been?" We hide some weeks, forecast
them from the weeks before, and compare with what really happened. The comparison is the simplest guess,
**"same as last week"** (the last week it could see, repeated). Error = the average of |guess − real| in orders per week
(lower is better). The weights were **not** tuned to win these checks.

### Single backtest (real: hide the last 4 weeks)

| Week starting | Real | My method | Same as last week |
|---|---|---|---|
| 5 Oct | 8 | 6.4 | 7 |
| 12 Oct | 8 | 6.6 | 7 |
| 19 Oct | 9 | 6.7 | 7 |
| 26 Oct | 13 | 6.9 | 7 |
| **Average miss** | | **2.85** | **2.50** |

### Rolling backtest (real: every possible cut-off)

From each cut-off with at least 4 weeks before it and 4 weeks after it, forecast the next 4 weeks and compare. The
test seller has 17 full weeks, so there are **10 cut-offs** (40 week-forecasts).

| | My method | Same as last week |
|---|---|---|
| **Average miss (orders per week)** | **1.06** | **1.28** |

### What this does and doesn't show

1. **My method lost the most recent month** (2.85 vs 2.50). Orders jumped to 13 in the last week after a slow rise;
   the method learned from the slow rise and stayed behind the jump.
2. **The rolling result suggests the method is reasonable, but does not prove it.** The 10 cut-offs overlap (each
   one reuses most of the same weeks), so they are not 10 independent tests. And it is one shop.
3. **The sample orders look generated:** they rise very smoothly (4, 4, 5, 4, 5, … 13), unlike a real home business.
   Real shops will be noisier, so real errors are likely to be bigger.

---

## 5. Existing features: For You feed and Trending

These were built by teammates (Jessie: For You; Cheyenne: activity signals and Trending). This section only describes
what `server/routes/feed.js` and `server/utils/trends.js` do. No results are claimed: there is no backtest or
measurement of these features in the project.

### 5a. For You feed

**Code:** `server/routes/feed.js` (`loadSignals`, `scoreProduct`) · `GET /feed/:userId?tab=foryou`

**Method in plain words:** every available product gets points for each reason this buyer might like it. Products
are sorted by points, at most 3 per shop, top 20. The card shows the reason that added the most points
("Why recommended?").

**Interest from actions:** view = 1, click = 2, save = 3, order = 4 (just scrolling past counts 0), multiplied by
`0.5 ^ (age in days / 7)`, so an action is worth half after a week and a quarter after two.
(The code comment mentions "last 30 days", but the query has no date limit: older actions just fade.)

| Reason | Points (from `scoreProduct`) |
|---|---|
| Category is one of the buyer's chosen interests | +3 |
| Seller's trust score (0–100, 50 if none) | trust / 50 (0 to 2) |
| New seller (shop 30 days old or less) | +1.5 |
| Buyer favourited things in this category | number of favourites, at most 3 |
| Buyer looked at this exact product (and hasn't bought it) | interest (at most 6) × 0.4 |
| Buyer often browses this category | interest (at most 8) × 0.3 |
| Shares tags with products the buyer looked at | tag interest (at most 8) × 0.35 |
| Matches a recent search (last 20 searches, half-life 7 days) | search points (at most 2) × 2 |
| Buyer follows the shop | +3 |
| Buyer bought it before | +4 |
| Shop's followers | followers / 20, at most 1 |
| Trending this week (see 5b) | trending score / 10, at most 1.5 |

**Why these weights:** the code ranks actions by how much effort they take (order > save > click > view) and caps
each signal so no single one can take over. The code does not record how the exact numbers were chosen.

**Worked example (made-up):** a buyer who chose "Baked goods" as an interest, follows the shop, and clicked this
loaf twice yesterday: the clicks give interest 2 × 2 × 0.5^(1/7) ≈ 3.6. Points: 3 (interest) + 3 (follows) +
1 (trust 50 / 50) + 3.6 × 0.4 ≈ 1.4 (looked at it) + 3.6 × 0.3 ≈ 1.1 (browses the category) ≈ **9.5**, plus a little
for the shop's followers and any trending points. (The loaf's own tags add nothing: its own views are not counted twice.)
The card would say "Matches your interest in Baked goods" (the first of the two 3-point reasons).

### 5b. Trending

**Code:** `feed.js` (`loadTrending`) and `trends.js` (`refreshTrends`, `youtubeInterest`, `growthFor`, `keywordsFor`) ·
`GET /feed/:userId?tab=trending`

**On our site (last 7 days):** view = 1, click = 2, save = 4, order = 6, with a half-life of 3 days. One buyer can add
at most 8 points to one product, so nobody can push a product up by clicking it 100 times.

**Online (YouTube, once a day):**
1. Keywords come from products: every tag, the whole product name, and the last word of the name (`keywordsFor`).
   The 40 keywords used by the most products are checked once a day (the free quota allows 100 searches a day).
2. For each keyword, YouTube is searched for the most-viewed videos uploaded in the last 14 days (region Singapore).
   A video is kept only if its title and tags contain at least half the keyword's words and it is not Music, Sports,
   Gaming or News. If a Gemini key is set, Gemini also drops videos that only mention the word.
3. **Growth** (`growthFor`):
   - with a saved value from 6–9 days ago: `(views now − views a week ago) / max(views a week ago, 1000)`;
   - in the first week: `(views per day this week − last week) / max(last week per day, 1000 / 7)`.
4. Results are saved in MongoDB (`TrendSignal`), so restarts don't use the quota again.

**Points:** only keywords rising more than 5% count: `min(growth, 1) × 5`, × 1.2 if the keyword had at least 50,000
views. Trending score = site points + online points; sorted by score (ties: better-rated shop first), at most 3 per
shop, top 20. The reason is the bigger part, e.g. "Ordered 3 times this week" or
'"Loaf" is trending on YouTube (+246% this week)'.

**Why these weights:** an order says more than a view; the per-buyer cap stops one person gaming it; the 1000-view
floor stops tiny numbers from looking like huge growth. The code does not record how the exact numbers were chosen.

---

## 6. How to explain it (about 30 seconds each, to say out loud)

**Forecast.** "Home sellers guess how many slots to open. We look at their completed orders week by week. We take a
weighted average of the last 4 weeks, where the newest week counts most, and add the trend from a straight line
through the last few months. That gives an estimate for the next 4 weeks. The range shows how far past weeks usually
were from the line, so it's a typical miss, not a promise. With fewer than 4 weeks or 10 orders we don't guess."

**Busiest weekdays.** "We count completed orders by the weekday of pickup. If orders were spread evenly, any 2 days
would have about 29% of them, so we only say 'add capacity on Saturdays and Sundays' when the top 2 days have at least
40%. Otherwise we tell the seller their orders are spread evenly, so we don't give advice the data doesn't support."

**What to make next.** "For each category the seller sells, we compare the last 4 weeks of orders with the 4 before,
and we check whether a keyword in that category is rising on YouTube. The score is 60% own growth plus 40% trend,
because the shop's own buyers matter more than general interest. Every suggestion shows its reason, like 'Orders for
Baked goods grew 61% and loaf is trending', and if there's no YouTube data we use own orders only and say so."

**For You (teammate's feature).** "Each product gets points for every reason this buyer might like it: their chosen
interests, what they viewed, saved, searched for or bought, the shops they follow, and the seller's trust score.
Recent actions count more, halving every week. We sort by points, show at most 3 per shop, and the card shows the
biggest reason as 'Why recommended?'."

**Trending (teammate's feature).** "Trending mixes what's popular on our site this week (orders, saves, clicks and views,
with each buyer capped so nobody can game it) with what's rising on YouTube in Singapore for the keywords our sellers
use. We filter out music, sports and gaming videos, and optionally ask Gemini to drop off-topic ones, then compare this
week's views with last week's."

---

## 7. Known limitations

- **Login tokens:** a token lasts 7 days and cannot be cancelled before then (the server keeps no list of tokens, it
  only checks the signature and the expiry). If `JWT_SECRET` is not set in `config.env`, the signing secret is derived
  from the database link (`server/utils/auth.js`). The new route uses `requireShopOwner`, so it has the same limits as
  the other shop-owner routes.
- **Trend keywords can be whole product names** (e.g. "cookie monster special"), because `keywordsFor` in `trends.js`
  uses the full name as a keyword. Trend growth can also be very large (one keyword showed over +1,000,000%); both
  features cap it at +100% when scoring.
- **The forecast ignores holidays and festivals** (e.g. Chinese New Year, Hari Raya): it only knows past weekly totals.
- **One category gives few suggestions:** "What to make next" ranks the categories the seller already sells, so a shop
  with one category gets one suggestion (with up to 3 keyword ideas under it).
- **The new route `GET /forecast/make-next/:shopId` has no automated test** (it needs a database; it was checked by hand:
  401 without a login, 200 for the shop owner). `MakeNextSection.vue`, which loads it, has no test either.
- **Small, generated sample data:** the backtest numbers come from one test shop with smooth, generated-looking orders.
- **Open item for its owner:** `server/utils/trust.js` line 30 has `TODO (Yu Chen): tune the weights` for the trust
  score, which the For You feed uses. It was not changed.

---

## 8. Packages added

**None.** The forecast chart is drawn by hand in SVG (like the existing Sales trend chart), and all the maths is plain
JavaScript. (The test tools – Vitest, Vue Test Utils, jsdom, Playwright – were added earlier for testing; see TESTING.md.)

---

## 9. Teammate-owned files changed for this feature

| File | Owner | What changed and why |
|---|---|---|
| `client/src/views/seller/SalesAnalyticsView.vue` | Analytics page (created by meowmeowthecat) | 2 import lines; `view` + `VIEWS` (2 lines); a "Sales so far / Forecast" toggle next to the title (same classes as the Day / Month / Year toggle); the subtitle changes with the view; the existing analytics are wrapped in `<template v-if="view === 'sales'">` (not re-indented) and the Forecast and What to make next panels are in the `v-else`. |
| `server/server.js` | shared | 1 import + 1 `app.use('/forecast', …)` line, to register the new read-only route. |
| `client/src/components/TopBar.vue` | Cheyenne | 2 CSS rules inside the existing `@media (max-width: 420px)` block (`.pill-btn` and `.user-btn` padding), so the top bar no longer makes every page scroll sideways on phones (checked at 360, 375 and 390 px). |

Not changed: `server/utils/trends.js` (only imported), `server/routes/orders.js`, `server/utils/trust.js`.
