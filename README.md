This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Storage

Reports persist in Upstash Redis only (30-day TTL). No relational DB required. Configure `REDIS_URL` and `REDIS_TOKEN` in your environment.

## Optional Social Collector Credentials

Reddit, Stack Overflow, and YouTube collectors ship in **dark-launch** mode: they run when their credentials are present and otherwise return empty results without failing the analysis. None of them affect the report API surface or composite score yet — their metrics are persisted to a dedicated Redis blob (`rpi:social:metrics:{analysisId}`, 30-day TTL) for inspection and future activation.

All three are optional. With no keys set, collectors return zeroed metrics with `reason: "unconfigured"` and the pipeline proceeds with HackerNews-only social signal as today.

### Reddit (`REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET`, `REDDIT_USER_AGENT`)

1. Visit https://www.reddit.com/prefs/apps and click **create another app...**.
2. Choose the **script** type. Set name = `RepoPopIndex` (any), redirect URI = `http://localhost:8080` (unused for client_credentials grant). Click **create app**.
3. Copy the `client id` shown under the app name (~14 chars) → `REDDIT_CLIENT_ID`.
4. Copy `secret` → `REDDIT_CLIENT_SECRET`.
5. Set `REDDIT_USER_AGENT` to a descriptive string Reddit will accept, e.g. `web:com.example.repopopindex:v1.0 (by /u/<your-reddit-handle>)`. Reddit blocks generic UAs.
6. Restart the app. The Reddit collector activates automatically.

### Stack Overflow (`STACKEXCHANGE_KEY`, optional)

Anonymous calls work day-1 with a 300 req/IP/day quota. Skip this section unless you need >300 req/day.

1. Register an app at https://stackapps.com/apps/oauth/register (Application name = `RepoPopIndex`, OAuth domain = `localhost`). Click **Register Your Application**.
2. Copy `Key` (NOT `Client Id` / `Client Secret`) → `STACKEXCHANGE_KEY`. Quota lifts to 10,000 req/day per IP.

### YouTube Data API v3 (`YOUTUBE_API_KEY`)

1. Open https://console.cloud.google.com/ and create or select a project.
2. **APIs & Services → Library** → search "YouTube Data API v3" → click **Enable**.
3. **APIs & Services → Credentials → Create Credentials → API key**. Copy the key → `YOUTUBE_API_KEY`.
4. Recommended: click **Restrict key** and set **API restrictions** to **YouTube Data API v3** only.
5. Default daily quota is 10,000 units. Each analysis costs ~101 units (capped); roughly 6 distinct repos/day at full cache-miss rate. Request a quota increase via the Cloud Console if needed.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
