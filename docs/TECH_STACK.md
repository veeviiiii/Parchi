# Parchi — tech stack

Paste a messy chat, get a clean order, a proper bill, and a community feed. One Next.js app: the pages and the server routes live together, and the API keys never leave the server.

## AI

| What | Used for |
|---|---|
| **Gemma 4 — `gemma-4-26b-a4b-it`** (26B mixture of experts, ~4B active per token) | Job 1: read one chat message → `{ intent, items, unclear }`. Job 2: read one Crowdmind post → tag, one-line summary, quoted prices, moderation. |
| **Gemini API** via **`@google/genai`** (Google's official SDK) | Calls Gemma from the server only. Structured JSON output with a response schema, temperature 0.2, `MINIMAL` thinking, built-in retries (3 attempts, 15 s timeout each). |

Gemma only does language. Plain code does everything else: splitting the chat, grouping, cancellations, prices, totals, bills, permissions, and checking that every item Gemma returns is really quoted in the message.

## App

| Library / tool | Version | Used for |
|---|---|---|
| **Next.js** (App Router, Turbopack) | 16.3 | Pages, server API routes (`/api/parse`, `/api/crowdmind/posts`), fonts, build |
| **React** | 19.2 | UI, `useReducer` for the order state |
| **TypeScript** | 5 | Types for every data shape (messages, orders, bills, posts) |
| **Tailwind CSS** | 4 | Utility styles on the app pages; theme colours come from CSS variables |
| **zod** | 4 | Validates every Gemma answer before the app trusts it |
| **@supabase/supabase-js** | 2 | Crowdmind posts in Postgres (server only, secret key). Falls back to in-memory posts when not configured |
| **next/font** (Google Fonts, self-hosted at build) | — | Manrope for the UI; Noto Sans Devanagari, Bengali, Gujarati, Kannada and other Indian scripts for the multilingual "Parchi" word |

## Data and hosting

| Service | Used for |
|---|---|
| **Supabase** (Postgres, Mumbai) | `posts` table for Crowdmind. Row level security on, no public access: only the server reads and writes. |
| **Browser localStorage** | The current order, the chosen role and theme, and saved bills (latest 20). Nothing personal goes to a database. |
| **Vercel** (Hobby) | Hosting and deploys from GitHub `main`. Env vars: `GEMINI_API_KEY`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, optional `GEMMA_MODEL`. |
| **GitHub** | Public repo, MIT license |

## Quality

| Tool | Used for |
|---|---|
| **Vitest** 5 | Unit tests for the pure logic: chat splitting, combining orders, money, bills (amount in words, exact splits), roles, Crowdmind guards |
| **`scripts/prompt-tests.mjs`** | Runs the Gemma prompt test tables (10 order messages, 6 Crowdmind posts, access checks) against the running app |
| **ESLint** (`eslint-config-next`) | Lint, including React hooks rules |

## Built with

The app uses Gemma 4 at runtime. The code was written with help from Claude Code (Anthropic).
