# Parchi — V2 features spec

> Read this together with `CLAUDE.md`. Where they conflict, **this file wins** (scope, out-of-scope list, routes, build order).
> The product name is **Parchi** everywhere, in the UI, README, and code comments. Replace any leftover "Buy Together".

---

## 1. What's new, in one paragraph

Parchi becomes "Parchi for everyone." A visitor picks who they are: **Consumer**, **Community**, or **Merchant**. That choice shapes everything else:
- how the order builder reads their chat
- which bills they get
- which Crowdmind space (community feed) they see
- which support FAQs they see

Gemma 4 now has three jobs instead of one:
1. reading chat messages into orders (existing)
2. tagging, moderating, and extracting price lists from Crowdmind posts
3. matching support questions to FAQs and drafting consumer complaints

Code still does all the maths, permissions, and storage.

---

## 2. Scope changes (overrides CLAUDE.md section 3)

**Now in scope:**
- Role selection, with no real auth. The role is self-chosen and stored in the browser.
- Crowdmind, a shared feed stored in Supabase (with an in-memory fallback).
- Bills
- The support portal

**Still out of scope:**
- Login or verified accounts
- Payments
- Real-time chat
- Voice input
- Price lookup from the internet

**Other AI providers:** not planned. Ask first.

**UI:** keep it functional, clean, and minimal for now: white background, ink text, sensible spacing, mobile-first. No design polish and no animations. The developer will lead a separate UI pass after N5. The only branding required now is the wordmark (section 6).

**Approved new dependency:** `@supabase/supabase-js`. Nothing else without asking.

**New env vars (server only, never prefix with `NEXT_PUBLIC_`):**
- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY`, the Supabase secret key (starts with `sb_secret_`). New Supabase projects no longer have the legacy `service_role` key.

---

## 3. Roles and access

```ts
type Role = "consumer" | "community" | "merchant";
type Profile = { role: Role; name: string }; // localStorage key: "parchi.profile"
```

| Role | Who | `name` means |
|---|---|---|
| Consumer | Buying for themselves | Their name |
| Community | Collects orders for a group (hostel, class, society, club) | Group name, e.g. "Hostel B Block" |
| Merchant | Runs a shop | Shop name, e.g. "Sharma Stationers" |

### Crowdmind access matrix (`lib/roles.ts`, pure, with vitest tests)

Each role **reads only its own space**. Posting rules:

| Space | Who reads it | Who can post into it |
|---|---|---|
| `consumer` ("Buyers") | consumers | consumers, communities, merchants |
| `community` ("Communities") | communities | communities, merchants |
| `merchant` ("Merchants") | merchants | merchants, communities |

This gives:
- community → buyers
- community → merchants
- merchant → buyers (offers)
- a merchants-only space

The server enforces this on every request. Never trust the client alone.

**Honesty note for README and judges:** roles are self-selected for the demo. A real launch needs verified merchant accounts.

---

## 4. Routes and structure (additions)

```
app/
  page.tsx                      landing: hero + role picker (NEW)
  order/page.tsx                the existing order builder, MOVED here from app/page.tsx (move it, don't rewrite it)
  bill/[id]/page.tsx            printable bill (reads from localStorage)
  bills/page.tsx                bill history
  crowdmind/page.tsx            feed for your role's space
  support/page.tsx              FAQs + "describe your problem" + NCH panel
  api/parse/route.ts            existing, now also accepts { role }
  api/crowdmind/posts/route.ts  GET feed for a space, POST new post (Gemma check first)
  api/crowdmind/like/route.ts   POST { id }
  api/support/route.ts          POST { role, text }
components/
  ParchiMark.tsx                Devanagari wordmark, reused on landing, header, bill
  AppHeader.tsx                 wordmark, nav, role chip with "Change"
  RoleGate.tsx                  no profile → redirect to /
lib/
  roles.ts  profile.ts  bill.ts  nch.ts
  gemmaJson.ts                  shared Gemma helper (section 5)
  crowdmind/{prompt,schema,store,seed}.ts
  support/{faqs,prompt,schema}.ts
```

**Header nav** (all role pages): Order · Bills · Crowdmind · Support. The Order label changes by role:
- "My list" for consumers
- "Group order" for communities
- "Customer orders" for merchants

---

## 5. Shared Gemma helper (`lib/gemmaJson.ts`)

Extract the existing call-and-cleanup logic from the parse route into one reusable function:

```
callGemmaJSON({ system, text, schema }) → validated object | error
```

It must keep every rule from CLAUDE.md section 8:
- JSON MIME type
- temperature around 0.2
- fence stripping, then zod validation
- one retry with "Return only valid JSON matching the schema"
- one retry on 429 or network error after 2 seconds
- fresh, independent requests with no chat history

All three Gemma routes use it. After refactoring, **re-run all CLAUDE.md section 9 prompt tests** to prove `/api/parse` still behaves.

---

## 6. N1: landing page + role picker

**Wordmark:** **पर्ची** in **Rozha One** (Google Fonts, by Indian Type Foundry, a bold Devanagari display face), with fallback Hind 700. A small Latin "Parchi" sits under it. The wordmark is used top-left in the header and on bills.

**Hero:**
- the large wordmark
- headline: **"Parchi for everyone"** (exact text)
- one supporting line, e.g. "Paste a messy chat. Get a clean order, a proper bill, and a community that's in the loop."

**Role picker:** three choices, one tap each.
- **Consumer**: "I'm buying for myself"
- **Community**: "I collect orders for my group: hostel, class, society, club"
- **Merchant**: "I run a shop"

Then one name field, labelled by role ("Your name" / "Group name" / "Shop name"), and a Continue button that saves the profile and goes to `/order`.

**Returning visitors** see "Continue as Hostel B Block (Community)" plus "Change."

**Done when:**
- A fresh visit shows the hero and picker.
- Choosing a role and name lands on `/order`, and a reload remembers it.
- "Change" works.
- Visiting `/crowdmind` with no profile redirects to `/`.

---

## 7. N2: role-aware order builder ("curates context for the orders")

| Role | Input | Output |
|---|---|---|
| Consumer | Their own list, which may be plain lines with no names ("2 copy, ek scale") | Shopping list + bill. No "who owes what." |
| Community | Group chat (the existing flow, unchanged) | Group order + who owes what + one bill with a per-person split |
| Merchant | Their shop's chat with customers, plus a field "Your name in this chat" (prefilled with the shop name) | Per-customer order cards + a combined **pack list** + one bill per customer |

**Rules:**
- **Consumer mode parsing:** if no line matches a WhatsApp timestamp format, treat every non-empty line as one message from sender "You". Don't apply the plain `Name: text` fallback here, or "pen: 2" would become a sender called "pen". Add vitest tests.
- **Merchant mode:** messages whose sender matches "Your name in this chat" (case-insensitive, trimmed) are skipped **in code, before Gemma**. Customers are the senders.
- **Role context to Gemma:** `/api/parse` accepts `{ text, role }` and adds one short context line to the prompt:
  - consumer: "a personal shopping list"
  - community: "a group order chat"
  - merchant: "customers ordering from a shop"
- **The JSON contract from CLAUDE.md section 7 does not change.** Re-run the section 9 tests in all three roles.

**Done when:**
- All three roles work on their own sample input. Add one sample per role to `lib/sampleChat.ts`, and keep the original community sample as is.
- The prompt tests still pass.

---

## 8. N3: bills (`lib/bill.ts`, pure, with vitest tests)

**When:** a "Generate bill" button on the order page. It's enabled only when every included row has a quantity and a unit price. Otherwise it shows "Add 2 missing prices first." In merchant mode, there's one button per customer.

**Bill contents, top to bottom:**
1. **Top-left:** the ParchiMark wordmark. **Top-right:**
   - bill number `PCH-YYMMDD-XXXX` (4 random uppercase base36 characters)
   - date and time via `Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })`
2. **From / To:**
   - merchant: From = shop, To = customer
   - community: From = optional "Shop name" input, To = group name
   - consumer: From = optional shop name, To = their name
3. **Table:** #, Item (name + variant), Qty, Rate (₹), Amount (₹)
4. **Totals:**
   - subtotal
   - grand total
   - **amount in words** using the Indian system, e.g. "Rupees Twelve Lakh Thirty-Four Thousand Five Hundred Sixty-Seven and Eighty-Nine Paise Only"
5. **Community only:** a "Split" section showing each person and their amount. These amounts must add up exactly to the grand total.
6. **Footer:** "Generated with Parchi · Parchi for everyone" and "This is not a GST tax invoice."

**Actions:**
- **Print / Save as PDF** via `window.print()`. Use `@media print` to hide the header, nav, and buttons, on A4 portrait.
- **Copy bill as text** for WhatsApp.

**Storage:**
- Bills save to localStorage `parchi.bills` (keep the latest 20).
- `/bill/[id]` reads a bill from there.
- `/bills` lists the saved bills.
- A missing ID shows "This bill isn't saved on this device."

**Tests (vitest):**
- amount in words for: 0, 1, 15, 100, 1,234, 1,00,000, and 12,34,567.89
- bill totals
- split sums
- bill number format

---

## 9. N4: Crowdmind (community feed)

**What it is:** a YouTube-community-style feed. Each role sees only its own space (section 3).

**Each post card shows:**
- author name and role badge
- time ago
- Gemma's tag chip
- the body text
- Gemma's one-line summary
- the extracted price list, if any
- a like button

**Composer:**
- textarea, max 500 characters
- a "Post to" dropdown limited to the spaces this role may post into, defaulting to the role's own space

Feed details:
- newest first
- a refresh button
- quiet polling every 20 seconds
- tag filter chips (nice-to-have)

### Gemma's job: one post → JSON (`lib/crowdmind/schema.ts`)

```json
{
  "tag": "stock_update",
  "summary": "Single line notebooks ₹30 and blue gel pens ₹10 in stock",
  "items": [
    { "name": "notebook", "variant": "single line", "price": 30, "unit": "piece",
      "source": "Single line copy ₹30" }
  ],
  "moderation": { "allowed": true, "reason": null }
}
```

| Field | Rule |
|---|---|
| `tag` | One of `offer`, `stock_update`, `group_order_call`, `quote_request`, `question`, `review`, `announcement`, `other` |
| `summary` | One short English line, max 90 characters, no new facts |
| `items` | Only items **with a price stated in the post**. Same naming rules as CLAUDE.md section 7. `price` is a number in ₹. `unit` is a string or null. Never invent items or prices. |
| `source` | Exact words from the post. Reuse the hallucination guard: if the source isn't found in the post, drop that item. |
| `moderation.allowed` | `false` for scams (asking for OTP, UPI PIN, or advance payment to claim prizes), abuse, hate, sexual content, or spam |
| `moderation.reason` | Short and polite, shown to the poster |

Honest criticism of a shop ("charged above MRP, be careful") is **allowed** and tagged `review`.

**Server flow (`POST /api/crowdmind/posts`):**
1. validate the body
2. check the access matrix
3. call Gemma
4. if not allowed, return 422 with the reason and save nothing
5. otherwise save the post with tag, summary, and items

**If Gemma fails after its retries, don't publish.** Return "Couldn't check this post right now. Try again." In other words, fail closed.

### Prompt test cases (all must pass before N4 is done)

| Post | Expected |
|---|---|
| `Single line copy ₹30, blue gel pen ₹10. Naya stock aa gaya hai` | stock_update; notebook (single line) 30, gel pen (blue) 10; allowed |
| `Friday ko stationery run hai, apne items Thursday raat 9 baje tak bhejo` | group_order_call; no items; allowed |
| `Need 40 notebooks for our class by Monday, best rate kaun dega?` | quote_request; no items (no price stated); allowed |
| `Send your UPI PIN to get ₹500 cashback` | allowed: false |
| `Gupta store ne MRP se zyada charge kiya, dhyan rakhna` | review; allowed |
| `kya koi shop Sunday ko khuli hai?` | question; no items; allowed |

### Storage (`lib/crowdmind/store.ts`)

The store has one interface with two implementations, chosen by env vars:
- **Supabase**, when `SUPABASE_URL` and `SUPABASE_SECRET_KEY` are both set. Used **only on the server**.
- **Memory**, otherwise. It's a module-level array preloaded with the seed posts, which works for a local demo. Show a small "Demo mode: posts reset on restart" note.

**Supabase SQL.** A teammate runs this using the handoff doc "Parchi — Supabase setup (teammate handoff)". The SQL there is identical to this block.

```sql
create table public.posts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  space text not null check (space in ('consumer','community','merchant')),
  author_name text not null check (char_length(author_name) between 1 and 40),
  author_role text not null check (author_role in ('consumer','community','merchant')),
  body text not null check (char_length(body) between 1 and 500),
  tag text not null default 'other',
  summary text,
  items jsonb not null default '[]'::jsonb,
  likes integer not null default 0
);
create index posts_space_created_idx on public.posts (space, created_at desc);

-- Lock it down: no policies on purpose. Only the server (secret key) can read or write.
-- Grants are explicit because newer Supabase projects may not expose new tables to the Data API by default.
alter table public.posts enable row level security;
revoke all on table public.posts from anon, authenticated;
grant select, insert, update, delete on table public.posts to service_role;

create or replace function public.like_post(post_id uuid)
returns integer
language sql
set search_path = ''
as $$
  update public.posts set likes = likes + 1 where id = post_id returning likes;
$$;
revoke execute on function public.like_post(uuid) from public, anon, authenticated;
grant execute on function public.like_post(uuid) to service_role;

insert into public.posts (space, author_name, author_role, body, tag, summary, items) values
('consumer','Sharma Stationers','merchant','Single line copy ₹30, blue gel pen ₹10. Naya stock aa gaya hai','stock_update','Single line notebooks ₹30 and blue gel pens ₹10 in stock',
 '[{"name":"notebook","variant":"single line","price":30,"unit":"piece","source":"Single line copy ₹30"},{"name":"gel pen","variant":"blue","price":10,"unit":"piece","source":"blue gel pen ₹10"}]'),
('consumer','Hostel B Block','community','Friday ko stationery run hai. Apne items Thursday raat 9 baje tak bhejo!','group_order_call','Stationery group order on Friday, send items by Thursday 9 pm','[]'),
('community','CSE 2nd Year','community','Anyone ordering lab coats in bulk? Combine karte hain, better rate milega','question','Looking to combine bulk lab coat orders','[]'),
('community','Sharma Stationers','merchant','Group orders above 30 notebooks get 10% off this week','offer','10% off group orders above 30 notebooks','[]'),
('merchant','Hostel B Block','community','Need 40 single line notebooks + 20 geometry boxes by Monday. Quote bhejo','quote_request','Wants a quote for 40 notebooks and 20 geometry boxes by Monday','[]'),
('merchant','Verma General Store','merchant','A4 sheet supplier rates badh gaye hain, kisi ke paas sasta wholesaler hai?','question','Asking for a cheaper A4 sheet wholesaler','[]');
```

**Seed posts are pre-tagged sample data.** They don't use Gemma calls. Mirror them in `lib/crowdmind/seed.ts` for memory mode.

**Likes:** call `rpc('like_post', { post_id })` in Supabase mode. The client remembers liked IDs in localStorage so a post can't be liked twice from one browser.

**Done when:**
- Memory mode works with no Supabase vars.
- With the vars set, posts persist across reloads and show up in a second browser.
- Each role sees only its own space.
- Posting into a disallowed space is rejected **by the server**.
- All six test cases pass.

---

## 10. N5: support portal

**Page layout (`/support`):**
1. **FAQ list** for the current role: an accordion plus a search box that filters in plain code.
2. **"Describe your problem"** box → `POST /api/support` → Gemma.
3. Results show the matched FAQs, then "Did this solve it?" with Yes and No buttons.
4. "No", or a detected consumer grievance, opens the **NCH panel**.
5. A "Still need help?" link to the NCH panel is always visible.

### FAQ data (`lib/support/faqs.ts`)

Each FAQ is `{ id, roles: Role[], q, a }`. Answers describe **how Parchi actually works**, truthfully. Consumer-rights answers point to NCH and give **no legal advice**.

| id | Roles | Question |
|---|---|---|
| `how-reads` | all | How does Parchi read my chat? |
| `flagged` | all | Why is an item highlighted? |
| `owes` | community | How is "who owes what" calculated? |
| `privacy` | all | Is my chat stored? Answer truthfully: messages are sent to Google's Gemini API to be read, chats aren't saved by Parchi, bills stay in this browser, and Crowdmind posts are stored and visible to that space. |
| `bill-print` | all | How do I print or save my bill as a PDF? |
| `change-role` | all | How do I switch between consumer, community, and merchant? |
| `crowdmind` | all | What is Crowdmind and who sees my posts? |
| `post-held` | all | Why wasn't my post published? |
| `overcharged` | consumer, community | A shop charged above MRP, refused a bill, or sold a faulty item. What can I do? (→ NCH) |
| `nch` | all | What is the National Consumer Helpline? |
| `customer-orders` | merchant | How do I turn my customer chat into orders? |
| `my-messages` | merchant | Why are my own messages skipped? |
| `merchant-bills` | merchant | How do I make a bill for each customer? |
| `gst` | merchant | Is a Parchi bill a GST tax invoice? (No.) |
| `post-offer` | merchant | How do I post an offer or stock update? |

### Gemma's job (`lib/support/schema.ts`)

**Input:** the user's text, plus the `{ id, q }` list for their role.

**Output:**

```json
{ "matches": ["overcharged", "nch"], "grievance": true,
  "complaint_draft": "On [date], [shop name] charged me ₹[amount] for ..., which is above the MRP printed on the pack. They also refused to give a bill. I request help resolving this." }
```

**Rules:**
- `matches` has at most 3 entries, using **only IDs from the given list**. Code drops any unknown ID.
- `grievance` is true only for a consumer problem with a shop or service.
- `complaint_draft` is null unless `grievance` is true. It's written in simple English, max 600 characters, and uses **only facts the user wrote**. Missing facts become `[shop name]`, `[date]`, `[amount]`. It never cites laws and never promises outcomes.

**Test cases:**

| Text | Expected |
|---|---|
| `bill print kaise karu` | matches includes `bill-print`; grievance false |
| `shopkeeper ne MRP se zyada paise liye aur bill dene se mana kar diya` | matches includes `overcharged`; grievance true; draft uses only the user's facts |
| `mera item highlighted kyun hai` | matches includes `flagged` |
| `hello` | no matches; grievance false |

### NCH panel (`lib/nch.ts`, the single source for these details; verified on consumerhelpline.gov.in, Oct 2026)

- **Toll-free:** 1915 or 1800-11-4000. Available 8 AM to 8 PM, all days except national holidays.
- **WhatsApp and SMS:** 8800001915
- **Web portal:** https://consumerhelpline.gov.in
- **Email:** nch-ca@gov.in
- Available in 17 languages.

**Buttons:**
- "Call 1915" (`tel:1915`)
- "WhatsApp NCH" (`https://wa.me/918800001915`)
- "Open NCH portal"
- "Copy complaint draft", when there is a draft

**For merchants:** add one line explaining that NCH handles complaints made as a consumer, for example against a supplier or service provider. For problems with the app itself, show "Contact the Parchi team" as a mailto link. Put the email address in a `TEAM_EMAIL` constant and ask the developer for it.

**Done when:**
- FAQ search works.
- The four test cases pass.
- The NCH panel shows exactly the details above.
- The tel and WhatsApp links open correctly.

---

## 11. N6: stretch (only if the developer says so)

1. **Fill prices from Crowdmind.** On the order sheet, a "Fill prices from a merchant post" button lets you pick a post that has extracted items. Code matches items by name + variant, then by name alone. It fills **only empty** prices and labels each one, e.g. "from Sharma Stationers' post." This connects Gemma job 2 to Gemma job 1. It's the best stretch demo.
2. Shareable bill links. This needs a Supabase `bills` table.
3. Comments on posts.
4. An optional GST % line on bills.

---

## 12. Build order, checks, and cut order

| # | Phase | Rough size |
|---|---|---|
| A | Finish pending CLAUDE.md phases 0–5. Skip Phase 6 (design) and hold Phase 7 (README/deploy). | depends on audit |
| N1 | Landing + roles + header + RoleGate | ~30 min |
| N2 | Role-aware order builder | ~45 min |
| N3 | Bills | ~45 min |
| N4 | Crowdmind | ~1.5 h |
| N5 | Support portal | ~45 min |
| N6 | Stretch | only on request |

Then **stop** for the developer-led UI pass. After that comes CLAUDE.md Phase 7 (README, deploy), using section 13 below.

At the end of every phase, follow the CLAUDE.md section 15 rules: run lint, vitest, and build; commit; give 3-step test instructions; and wait for "next".

**Cut order if behind.** Cut from the top, and say what you're cutting:
1. Drop N6.
2. Crowdmind: drop likes and tag filters.
3. Support: drop the Gemma matcher. Keep the static FAQs and NCH panel.
4. Bills: drop the history page. Keep generate + print.
5. Crowdmind: memory mode only (local demo), skipping Supabase.

**Never cut:**
- the core order flow
- landing + roles
- bill generation
- Gemma in Crowdmind

---

## 13. README additions (for Phase 7, later)

- **Gemma model used:** list all three integrations with file paths: `/api/parse`, `/api/crowdmind/posts`, `/api/support`, and `lib/gemmaJson.ts`.
- **"What Gemma does vs what code does,"** updated for the three jobs.
- **Data and privacy:**
  - chats are sent to the Gemini API and not stored by Parchi
  - bills stay in the browser
  - Crowdmind posts are stored in Supabase
  - roles are self-selected (no verification) in this demo
- **NCH details:** say where they came from and on what date they were checked.
- **AI usage credit:** Gemma 4 at runtime, and the code built with Claude Code (Anthropic).
