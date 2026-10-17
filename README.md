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
