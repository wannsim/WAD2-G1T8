# Homly Hauls - IS216 Group Project
 
One-stop platform for home businesses and buyers.
Stack: **Vue 3 (Composition API) + Vue Router + Axios + Bootstrap** on the front end, **Express + Mongoose + MongoDB Atlas** on the back end.
 
```
homly-hauls/
  client/   <- Vue app          (pnpm dev  -> http://localhost:5173)
  server/   <- Express API      (pnpm dev  -> http://localhost:8000)
```
 
---------------------------------------------------------------------
 
## First-time setup
 
Prerequisite: Node >= 22.12 and pnpm (`npm install -g pnpm`).
 
```bash
# terminal 1 - backend
cd server
pnpm install
pnpm add socket.io
pnpm dev                             # wait for "MongoDB connected"
 
# terminal 2 - frontend
cd client
pnpm install
pnpm add socket.io-client
pnpm dev                             # open the link it prints (http://localhost:5173)
```
 
Both terminals must be running at the same time.

Sample logins (password for all: `password123`):
`alice@test.com` (buyer), `bob@test.com` (seller), `cara@test.com` (seller)

## Seller sales analytics

Sellers can open **Analytics** in the navigation bar (`/seller/analytics`) to view sales revenue, completed orders, units sold, average order value, a sales trend, top products, and counts by order status. Choose the last 7, 30, or 90 days, or apply a custom date range. Dates use Singapore time; Refresh fetches the latest order statuses.

Sales count **completed orders only**, grouped by the date the order was placed, using the total price saved on each order. Orders with missing or invalid historical amounts still count toward completed orders and units, but are excluded from revenue and the average order value denominator. The dashboard explains when amounts are incomplete. Order-status counts include every status in the selected period.

Run the frontend analytics tests with `npm test` from `client/`, and build with `npm run build`. These tests use fixtures and do not access or seed the database. Dashboard access follows the project's existing client-side identity mechanism; the API does not yet enforce server-verified authentication.
 
---------------------------------------------------------------------

## Project structure

### Client (`client/src/`) - what the user sees (Vue)
| Folder | Purpose |
|---|---|
| `assets/` | Global CSS (`main.css`) and shared page styles (`auth.css`) |
| `router/` | Maps each URL to a page (e.g. `/browse` -> BrowseView). One file per feature |
| `views/` | Full pages/screens, grouped by feature (auth, seller, discover, orders, chat...) |
| `components/` | Reusable UI pieces used across pages (NavBar, ProductCard, StarRating...) |
| `utils/` | Helper code shared by many files (API address, login state, formatting, socket connection) |

### Server (`server/`) - data and rules (Express + MongoDB)
| Folder | Purpose |
|---|---|
| `models/` | Blueprint for each MongoDB collection: the fields and their types |
| `routes/` | API endpoints the client calls (GET / POST / PUT / DELETE) and the logic behind each |
| `utils/` | Server helper code (e.g. trust-score calculation) |
| `seed/` | Script that fills a database with sample data (wipes the database first) |
