# Rarefied

An index of rarity. A composite percentile calculator for men, anchored in real public data.

## Deploy to Vercel — the fastest path live (5 minutes)

This is the simplest way to get a live URL you can share on Instagram or text to friends.

### Step 1 — Get the code on GitHub

1. Go to [github.com/new](https://github.com/new) and create a new repo called `rarefied` (you can make it private if you want).
2. On your laptop, unzip the project folder, open Terminal in that folder, and run:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/rarefied.git
git push -u origin main
```

(Replace `YOUR_USERNAME` with your actual GitHub username.)

### Step 2 — Deploy via Vercel

1. Go to [vercel.com](https://vercel.com) and sign in with GitHub (free account).
2. Click **"Add New Project"** → **"Import Git Repository"**.
3. Pick your `rarefied` repo from the list.
4. Vercel auto-detects Next.js. Just click **Deploy**.
5. Wait ~1 minute. You'll get a live URL like `rarefied-abc123.vercel.app`.

That's it. Anyone clicking that link can use the app on their phone.

### Step 3 (optional) — Custom domain

In your Vercel project settings, go to **Domains** and add a custom domain like `rarefied.com.au`. You'll need to buy the domain separately (Namecheap, GoDaddy, ~$15/year for `.com`, ~$30/year for `.com.au`). Vercel walks you through the DNS setup.

## How sharing works

When someone hits **"Share My Score"** on the results page:

- **On mobile**: Native share sheet pops up. They can post the image straight to Instagram Stories, WhatsApp, Messages, etc.
- **On desktop**: PNG downloads automatically. They can drag it into Instagram, attach to email, etc.

The share card is rendered at 1080×1920 — Instagram Story dimensions — so it looks sharp on every platform.

## Running locally (optional)

If you want to test changes before pushing:

```bash
npm install
npm run dev
```

Open `http://localhost:3000` in your browser.

## Tech stack

- Next.js 14 (App Router)
- React 18
- `html-to-image` for the share card export
- All styling inline (no Tailwind / no external CSS framework)
- No backend, no database, no analytics. Pure static.

## Data sources

- ATO Taxation Statistics 2022-23 (Australian income)
- ABS Employee Earnings August 2025
- ABS Survey of Income & Housing 2021-22 (wealth by age)
- ABS National Health Survey 2011-12 (height)
- van den Hoek et al. 2024, J Sci Med Sport, n=809,986 (lifts)
- Natsal-3 / GSS (sexual frequency)
- Cooper Institute / general race data (5km running)

Percentiles are interpolated from these datasets. Directionally accurate, not surgically precise.
