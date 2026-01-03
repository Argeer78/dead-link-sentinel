# Dead Link Sentinel

**Honest, set-it-and-forget-it website monitoring.**

Dead Link Sentinel is a Micro-SaaS utility that automatically crawls your websites to find broken links (404s) and emails you a report. It is designed to be reliable, low-cost, and maintenance-free.

## Features
*   **🕷️ Smart Crawler:** Checks up to 50 pages per run (Serverless protected).
*   **📧 Email Alerts:** Sends a clean HTML report via Resend only when issues are found.
*   **⚡ Serverless Architecture:** Built on Next.js, running on Vercel/Supabase (Free Tier friendly).
*   **🛡️ Honest Design:** No tracking, no bloated analytics, just simple "Green/Red" status.

## Tech Stack
*   **Framework:** Next.js 14 (App Router)
*   **Database:** Supabase (PostgreSQL)
*   **Auth:** Supabase Auth (Magic Link)
*   **Email:** Resend
*   **Styling:** Tailwind CSS

## Deployment
1.  Push to GitHub.
2.  Import to Vercel.
3.  Add keys: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`.
4.  Set up Cron Job (visit `/api/cron` or use cron-job.org).
