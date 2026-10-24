# Strait example: web (Vite)

Built against this repo's own source (`"@straitlink/web": "file:../.."`), so CI fails here when the public API changes.
Shows the deep link (the page routes on the URL it was opened with), the deferred link (`resolveDeferredLink`, once per browser) and an event (`POST /v1/event`, the same call the app SDKs make).

1. `npm ci` in the repo root, then `npm ci` here.
2. `cp .env.example .env` and set your publishable key (`st_pub_…`, Dashboard → Get started).
3. `npm run dev`, open `http://localhost:5173/product/42`, then press "Log a purchase event".
