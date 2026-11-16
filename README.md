# DealPilot

A focused sales follow-up workspace for small B2B agencies and consultancies.

## Product direction

DealPilot helps small service businesses keep proposal conversations moving:
- Capture opportunities and proposal details
- Track next steps and follow-up dates
- Surface stale or at-risk deals
- Draft context-aware follow-up emails for human review

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
- Pipeline dashboard, deal capture, stage updates, search and follow-up drafts
- AI generation and Gmail sending are not connected yet

## Environment variables

Copy the environment variable names from `.env.example` into your local `.env.local` file. The Vercel production, preview and development environments are configured for the connected Supabase project.

Apply the SQL in `supabase/migrations` to a fresh Supabase project. Never commit secret or service-role keys.
