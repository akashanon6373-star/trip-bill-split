# Trip Bill Split

Split trip bills between Akash, Nitish, Badal, Suraj and Abhiraj. Anyone with the link can view and add bills, no login.

- `public/index.html` – the app
- `api/bills.js` – saves bills in Upstash Redis
- `seed.json` – the first 36 bills, loaded automatically the first time

## Deploy
1. Import this repo in Vercel (vercel.com/new).
2. In the project: **Storage → Create Database → Upstash for Redis** (free) → connect it to this project.
3. **Deployments → Redeploy**.
