# DealPilot

A focused sales follow-up workspace for small B2B agencies and consultancies.

## Product direction

DealPilot helps small service businesses keep proposal conversations moving:
- Capture opportunities and proposal details
- Track next steps and follow-up dates
- Surface stale or at-risk deals
- Generate deal-aware follow-up emails with AI for human review
- Save drafts, revisit them, and mark sent follow-ups
- Keep a lightweight activity log for opportunity creation, stage changes and AI drafts

## Stack

- Next.js App Router + TypeScript
- Tailwind CSS
- Supabase (authentication, database, storage) — to be connected
- Vercel deployment

## Local development

```bash
npm install
npm run dev
```

Create a `.env.local` file from `.env.example` when Supabase is configured.

## Current status

- Email/password sign-up and sign-in via Supabase Auth
- User-owned opportunities stored in Supabase Postgres with Row Level Security
- Pipeline dashboard, deal capture, stage updates, search and follow-up queue
- AI-generated email drafts via Vercel AI Gateway (OpenAI GPT-4.1 mini), saved per deal
- Drafts are review-and-copy only; sending through Gmail is not connected yet

## Environment variables

Copy the environment variable names from `.env.example` into your local `.env.local` file. The Vercel production, preview and development environments are configured for the connected Supabase project. Production AI drafting uses Vercel AI Gateway OIDC when available; local development requires an `AI_GATEWAY_API_KEY` or a locally pulled Vercel OIDC token.

Apply the SQL in `supabase/migrations` to a fresh Supabase project. Never commit secret or service-role keys.
