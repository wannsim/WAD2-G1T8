# HomeBiz - IS216 Group Project

One-stop platform for home businesses and buyers.
Stack: **Vue 3 (Composition API) + Vue Router + Axios + Bootstrap** on the front end, **Express + Mongoose + MongoDB Atlas** on the back end.
Everything follows what we learnt in Weeks 4-6 (see "Scope" at the bottom).

```
homebiz/
  client/   <- Vue app          (pnpm dev  -> http://localhost:5173)
  server/   <- Express API      (pnpm dev  -> http://localhost:8000)
```

---------------------------------------------------------------------

## 1. First-time setup (everyone)

Prerequisite: Node >= 22.12 and pnpm (`npm install -g pnpm`).

```bash
# terminal 1 - backend
cd server
pnpm install
cp config.env.example config.env     # then edit config.env (see section 2)
pnpm seed                            # optional: loads sample users/shops/products
pnpm dev

# terminal 2 - frontend
cd client
pnpm install
pnpm dev
```

Sample logins after `pnpm seed` (password for all: `password123`):
`alice@test.com` (buyer), `bob@test.com` (seller), `cara@test.com` (seller)

---------------------------------------------------------------------

## 2. MongoDB - what to put

**One person (e.g. Wan Sim, who owns "MongoDB") does steps 1-4 once. Everyone else does steps 5-6.**

1. Create a free account + cluster at https://www.mongodb.com/cloud/atlas (M0 free tier).
2. *Database Access* -> add a database user (username + password). Keep it simple, no special characters in the password.
3. *Network Access* -> add IP address `0.0.0.0/0` (allow from anywhere) so all 6 of you can connect. Fine for a school project.
4. *Connect -> Drivers* -> copy the connection string.
5. In `server/`, copy `config.env.example` to `config.env` and fill it in:

```
DB=mongodb+srv://<db_username>:<db_password>@cluster0.xxxxx.mongodb.net/homebiz_yourname?retryWrites=true&w=majority
PORT=8000
```

6. **Give yourself your own database name** (the bit after the last `/`, e.g. `homebiz_cheyenne`).
   Same cluster, separate data - so `pnpm seed` (which wipes the DB) never destroys a teammate's test data.
   Use one shared name (e.g. `homebiz_demo`) only when you want to demo together.

> `config.env` is in `.gitignore`. **Never commit it** - it contains your database password.

You do **not** create collections by hand: Mongoose creates them the first time data is saved.

### Collections (already defined in `server/models/`)

| Collection | Model file | Owner | What it stores |
|---|---|---|---|
| `users` | User.js | Wan Sim | name, email, hashed password, `role` (buyer/seller), buyer `preferences` |
| `shops` | Shop.js | Cheyenne (+ Yu Chen for `stats`) | owner, name, description, private address, `nearestMrt`, approximate `location {lat,lng}`, pickup/delivery, `stats` (rating, fulfilment, cancellation, response time, trustScore) |
| `products` | Product.js | Cheyenne | shop, name, category, price, unit, imageUrl, tags, customisable, `orderSlots[]`, isAvailable |
| `orders` | Order.js | Basile | buyer, shop, product, quantity, customisation, fulfilment, requestedTime, proposedTime, status, cancelledBy, respondedAt |
| `reviews` | Review.js | Yu Chen | order (1 review per order), buyer, shop, rating 1-5, comment |
| `favourites` | Favourite.js | Member 3 | user + product pairs |
| `interactions` | Interaction.js | Member 4 | user, product, shop, `type` = view / save / impression / order (feeds the FYP) |

How the pieces connect: `shop.owner -> user`, `product.shop -> shop`, `order.{buyer,shop,product}`, `review.order`.
**Changing a model's fields affects teammates - tell the group chat first.**

---------------------------------------------------------------------

## 3. Who owns what

Each person owns their own files, so you almost never edit the same file.

| # | Member | Feature | Client files | Server files |
|---|---|---|---|---|
| 1 | Yee Wan Sim | Auth, profiles, MongoDB | `views/auth/*`, `router/auth.routes.js`, `utils/auth.js`, `components/NavBar.vue` | `routes/users.js`, `models/User.js` |
| 2 | Cheyenne Loh | Seller shop + products | `views/seller/*`, `router/seller.routes.js` | `routes/shops.js`, `routes/products.js`, `models/Shop.js`, `models/Product.js` |
| 3 | (Jessie / Tanya - decide!) | Discovery, search, favourites, map | `views/discover/*`, `router/discover.routes.js`, `utils/geo.js`, `components/ProductCard.vue` | `routes/discover.js`, `routes/favourites.js`, `models/Favourite.js` |
| 4 | (Jessie / Tanya - decide!) | FYP recommendations | `views/feed/*`, `router/feed.routes.js` | `routes/feed.js`, `models/Interaction.js` |
| 5 | Basile Koh | Orders | `views/orders/*`, `router/order.routes.js` | `routes/orders.js`, `models/Order.js` |
| 6 | Liew Yu Chen | Reviews + trust score | `views/reviews/*`, `router/review.routes.js`, `components/ReviewList.vue`, `components/StarRating.vue` | `routes/reviews.js`, `utils/trust.js`, `models/Review.js` |

**Shared files (edit carefully, tell the group):** `utils/constants.js`, `utils/format.js`, `assets/main.css`, `App.vue`, `main.js`, `router/index.js`, `server/server.js`.

### Who depends on whom
- Everyone needs **Wan Sim's login** (`currentUser` in `utils/auth.js`) and **Cheyenne's shops/products** to have data to show. Use `pnpm seed` meanwhile.
- **Yu Chen -> Member 4:** `shop.stats.trustScore` (0-100) goes into the FYP score.
- **Basile -> Yu Chen:** order `status`, `respondedAt`, `cancelledBy` are the inputs to fulfilment / cancellation / response-time.
- **Cheyenne -> Member 3:** `shop.location` (approximate lat/lng) is what the map pins use.

---------------------------------------------------------------------

## 4. Team conventions

**Git**
- `main` always works. Work on a branch: `git checkout -b wansim/login-page`.
- Small commits, pull before you push (`git pull origin main`), open a pull request, a teammate vets it (matches the "Vet by" column in our tracking notes).

**Vue (same rules as the slides)**
- `src/views/` = pages that have a URL. `src/components/` = reusable pieces.
- Files: `PascalCase.vue`, views end in `View.vue`. Props in camelCase, used as kebab-case.
- Always `<script setup>`, `ref`, `computed`, `onMounted`. Always `:key` on `v-for`.
- New page? 1) create the `.vue` in your folder, 2) add a route in **your own** `*.routes.js`, 3) add a link in NavBar if needed.
- Use Bootstrap classes first. Our own CSS: `main.css` for global things, `<style scoped>` for one component.

**Talking to the backend**
- Always `axios` + `async/await` + `try/catch`, URL built from `API_URL` (`utils/config.js`).
- Look at any finished view (e.g. `views/seller/MyProductsView.vue`) and copy the pattern.
- Test an endpoint without the UI: open `http://localhost:8000/shops` in the browser, or use Postman.

**Login / access control**
- The logged-in user is `currentUser` from `@/utils/auth` (`_id`, `name`, `role`...). It lives in localStorage.
- To protect a page, copy the check at the top of `onMounted` in `MyProductsView.vue`.

---------------------------------------------------------------------

## 5. API cheat-sheet (base URL `http://localhost:8000`)

| Method + path | Does | Owner |
|---|---|---|
| POST `/users/register`, POST `/users/login` | sign up / log in | Wan Sim |
| GET, PUT `/users/:id` | read / update profile | Wan Sim |
| GET `/shops`, GET `/shops/:id`, GET `/shops/mine/:ownerId`, POST `/shops`, PUT `/shops/:id` | shops | Cheyenne |
| GET `/products?shop=`, GET `/products/:id`, POST, PUT `/products/:id`, DELETE `/products/:id` | products | Cheyenne |
| GET `/discover?q=&category=&minPrice=&maxPrice=` | search + filter | Member 3 |
| GET `/favourites/:userId`, GET `/favourites/:userId/ids`, POST `/favourites` | favourites (POST toggles) | Member 3 |
| GET `/feed/:userId` (or `guest`), POST `/feed/interactions` | For You feed, log interactions | Member 4 |
| POST `/orders`, GET `/orders/buyer/:userId`, GET `/orders/shop/:shopId`, PUT `/orders/:id/status` | orders | Basile |
| POST `/reviews`, GET `/reviews/shop/:shopId` | reviews | Yu Chen |

Every file has `TODO (Name)` comments marking what is still to build in your area. Search the project for `TODO`.

---------------------------------------------------------------------

## 6. Scope (what we use vs the slides)

**From the slides (Weeks 4-6):** `<script setup>`, `ref`, `computed`, `onMounted`/`onUnmounted`, `v-if/v-else`, `v-for` + `:key`, `v-model` (text, checkbox, radio, select, `.number`, `.trim`), `:class` / `:style` binding, `@click` / `@keyup.enter` / `@change`, Vue Router (`RouterLink`, `RouterView`, `:id` params, `redirect`, `router.push`), components with `defineProps` / `defineEmits` / `<slot>`, global registration, `localStorage` + `JSON.stringify/parse`, Axios GET/POST/PUT/DELETE with `async/await`, Bootstrap, Express + Mongoose + MongoDB Atlas.

**Not in the slides but needed (from our proposal / basic safety):**
- **Leaflet** (map) and **OpenStreetMap Nominatim** (address -> coordinates) - listed in our proposal's API section. Only Member 3 (`MapView.vue`) and Cheyenne (`ShopFormView.vue`) touch these.
- **bcryptjs** - passwords are stored hashed, never as plain text (`routes/users.js`).
- **`@` import alias** (`@/utils/auth`) - comes with the default `create vue` setup.

**Deliberately not used:** Pinia (we share the logged-in user with a simple `ref`), TypeScript, tests, navigation guards, JWT. Add later only if the team agrees.

**Known simplifications (mention in your report):** the API does not verify who is calling it (no tokens), so a determined user could call another user's endpoints. Fine for a class project; do not deploy as is.
