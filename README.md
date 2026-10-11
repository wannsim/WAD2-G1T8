# Homly Hauls - IS216 Group Project
 
One-stop platform for home businesses and buyers.
Stack: **Vue 3 (Composition API) + Vue Router + Axios + Bootstrap** on the front end, **Express + Mongoose + MongoDB Atlas** on the back end.
 
```
homly-hauls/
  client/   <- Vue app          (pnpm dev  -> http://localhost:5173)
  server/   <- Express API      (pnpm dev  -> http://localhost:8000)
```
 
---------------------------------------------------------------------
 
## 1. First-time setup
 
Prerequisite: Node >= 22.12 and pnpm (`npm install -g pnpm`).
 
```bash
# terminal 1 - backend
cd server
pnpm install
pnpm dev                             # wait for "MongoDB connected"
 
# terminal 2 - frontend
cd client
pnpm install
pnpm dev                             # open the link it prints (http://localhost:5173)
```
 
Both terminals must be running at the same time.
 
Sample logins (password for all: `password123`):
`alice@test.com` (buyer), `bob@test.com` (seller), `cara@test.com` (seller)
 
---------------------------------------------------------------------
 
## 2. MongoDB
 
### Collections (already defined in `server/models/`)
 
| Collection | Model file | Owner | What it stores |
|---|---|---|---|
| `users` | User.js | Wan Sim | name, email, hashed password, `role` (buyer/seller), buyer `preferences` |
| `shops` | Shop.js | Cheyenne (+ Yu Chen for `stats`) | owner, name, description, private address, `nearestMrt`, approximate `location {lat,lng}`, pickup/delivery, `stats` (rating, fulfilment, cancellation, response time, trustScore) |
| `products` | Product.js | Cheyenne | shop, name, category, price, unit, imageUrl, tags, customisable, `orderSlots[]`, isAvailable |
| `orders` | Order.js | Basile | buyer, shop, product, quantity, customisation, fulfilment, requestedTime, proposedTime, status, cancelledBy, respondedAt |
| `reviews` | Review.js | Yu Chen | order (1 review per order), buyer, shop, rating 1-5, comment |
| `favourites` | Favourite.js | Tanya | user + product pairs |
| `interactions` | Interaction.js | Jessie | user, product, shop, `type` = view / save / impression / order (feeds the FYP) |
 
How the pieces connect: `shop.owner -> user`, `product.shop -> shop`, `order.{buyer,shop,product}`, `review.order`.
**Changing a model's fields affects teammates - tell the group chat first.**
 
---------------------------------------------------------------------
 
## 3. Who owns what
 
Each person owns their own files, so you almost never edit the same file.
 
| # | Member | Feature | Client files | Server files |
|---|---|---|---|---|
| 1 | Yee Wan Sim | Auth, profiles, MongoDB | `views/auth/*`, `router/auth.routes.js`, `utils/auth.js`, `components/NavBar.vue` | `routes/users.js`, `models/User.js` |
| 2 | Cheyenne Loh | Seller shop + products | `views/seller/*`, `router/seller.routes.js` | `routes/shops.js`, `routes/products.js`, `models/Shop.js`, `models/Product.js` |
| 3 | Tanya Kumaravel | Discovery, search, favourites, map | `views/discover/*`, `router/discover.routes.js`, `utils/geo.js`, `components/ProductCard.vue` | `routes/discover.js`, `routes/favourites.js`, `models/Favourite.js` |
| 4 | Jessie Ong | FYP recommendations | `views/feed/*`, `router/feed.routes.js` | `routes/feed.js`, `models/Interaction.js` |
| 5 | Basile Koh | Orders | `views/orders/*`, `router/order.routes.js` | `routes/orders.js`, `models/Order.js` |
| 6 | Liew Yu Chen | Reviews + trust score | `views/reviews/*`, `router/review.routes.js`, `components/ReviewList.vue`, `components/StarRating.vue` | `routes/reviews.js`, `utils/trust.js`, `models/Review.js` |
 
**Shared files (edit carefully):** `utils/constants.js`, `utils/format.js`, `assets/main.css`, `App.vue`, `main.js`, `router/index.js`, `server/server.js`.
 
### Who depends on whom
- Everyone needs **Wan Sim's login** (`currentUser` in `utils/auth.js`) and **Cheyenne's shops/products** to have data to show. Use `pnpm seed` meanwhile.
- **Yu Chen -> Jessie:** `shop.stats.trustScore` (0-100) goes into the FYP score.
- **Basile -> Yu Chen:** order `status`, `respondedAt`, `cancelledBy` are the inputs to fulfilment / cancellation / response time.
- **Cheyenne -> Tanya:** `shop.location` (approximate lat/lng) is what the map pins use.
Search the project for `TODO` to see what is still to build in your area.
 
---------------------------------------------------------------------
 
## 4. API cheat-sheet (base URL `http://localhost:8000`)
 
| Method + path | Does | Owner |
|---|---|---|
| POST `/users/register`, POST `/users/login` | sign up / log in | Wan Sim |
| GET, PUT `/users/:id` | read / update profile | Wan Sim |
| GET `/shops`, GET `/shops/:id`, GET `/shops/mine/:ownerId`, POST `/shops`, PUT `/shops/:id` | shops | Cheyenne |
| GET `/products?shop=`, GET `/products/:id`, POST `/products`, PUT `/products/:id`, DELETE `/products/:id` | products | Cheyenne |
| GET `/discover?q=&category=&minPrice=&maxPrice=` | search + filter | Tanya |
| GET `/favourites/:userId`, GET `/favourites/:userId/ids`, POST `/favourites` | favourites (POST toggles) | Tanya |
| GET `/feed/:userId` (or `guest`), POST `/feed/interactions` | For You feed, log interactions | Jessie |
| POST `/orders`, GET `/orders/buyer/:userId`, GET `/orders/shop/:shopId`, PUT `/orders/:id/status` | orders | Basile |
| POST `/reviews`, GET `/reviews/shop/:shopId` | reviews | Yu Chen |
 
