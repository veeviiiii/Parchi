# Buy Together — project spec

> This is a planning document written before Hack Day. It contains decisions and requirements only. All code is written during the hacking period.
> It is the source of truth for this project. Re-read it whenever you're unsure.

---

## 1. Context

- **Event:** MLH Hack Day, 10 hours.
- **Challenge:** Challenge 01, "Best Use of Gemma 4."
- **Hard requirements:**
  - Use Gemma 4 through the Gemini API.
  - Make the AI a meaningful part of the app.
  - Name the Gemma model in the README.
  - Credit AI usage. MLH requires it, or the project is disqualified.
- **Repo:** public GitHub repo with an MIT license. Never commit API keys.
- **Developer:** a student building on an 8GB RAM laptop (i5-8250U, integrated graphics). Keep dependencies light and the dev setup simple. Explain what you did after each phase in plain language.
- **Network:** event Wi-Fi may be unreliable. Avoid unnecessary downloads.

---

## 2. The product

**One line:** paste your group chat, get one clean group order.

**Who it's for:** the person in a hostel, class, or club group who collects everyone's "mere liye bhi ek le aana" requests before going to the shop.

**The problem:** requests are scattered across a messy chat, in Hinglish, with vague quantities and changes of mind. Combining them by hand is slow and error-prone, and settling who owes what afterwards is worse.

**The flow:**
1. The organiser pastes the chat or uploads a WhatsApp export (.txt).
2. Gemma reads each message.
3. The app shows one grouped, editable order sheet.
4. The organiser fixes anything flagged and types in prices.
5. The organiser copies the order for the shopkeeper and the "who owes what" list for the group.

---

## 3. Scope

### Must-have (the MVP line, finish these first)
1. Paste chat, then click "Load sample chat," then "Build order."
2. Gemma parses each message through the server route, with visible progress.
3. A "How each message was read" list. This is the AI showcase for judges.
4. A grouped order sheet with total quantities. Flagged items are highlighted and fixable inline.
5. Unit prices, line totals, grand total, and "who owes what."
6. A "Copy order for shop" button.
7. The README meets every requirement in section 16.

### Nice-to-have (only after the MVP works end to end)
- "Copy who owes what" and CSV download
- Upload a WhatsApp export .txt
- Add, delete, and rename rows manually
- `localStorage` persistence
- The full design pass from section 13

### Cut line
If Phases 0–4 aren't done by hour 6, stop adding features. Do only three things:
- "Copy order for shop"
- the README
- making it reliable for the demo

### Out of scope
- Auth or accounts
- A database
- Real-time sharing
- Payments or price lookup
- Voice input
- Any AI provider other than Gemma

---

## 4. Tech stack (final decisions)

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js (App Router), latest stable, via `create-next-app`** | Frontend and backend in one project. The API route keeps the Gemini key on the server. One `npm run dev`, which is light enough for 8GB RAM. |
| Language | **TypeScript** | Catches mistakes in the data shapes before runtime. Claude Code is fluent in it. |
| Styling | **Tailwind CSS** (comes with `create-next-app`) | Fast to style, with no extra setup. |
| AI SDK | **`@google/genai`** | Google's official Gemini API SDK, which serves Gemma 4. |
| Validation | **`zod`** | Checks that Gemma's JSON has the right shape before the app trusts it. |
| Tests | **`vitest`**, for pure functions only | Fast checks for chat splitting and combining logic. No UI tests. |
| State | React `useReducer` (+ `localStorage` if time allows) | No database needed for a one-session tool. |
| Package manager | **npm** | Already installed with Node. Nothing extra to learn. |
| Hosting | **Vercel** (free Hobby tier) | One-click deploy from GitHub, with env vars set in the dashboard. Gives judges a live link. |
| Model | **`gemma-4-26b-a4b-it`**, read from env var `GEMMA_MODEL` with that default | Mixture of Experts: fast, because only ~4B parameters are active per token. Fallback: `gemma-4-31b-it`. |

**Rejected alternatives:**
- **Vite + React + Express:** two servers, two configs. More setup for no gain.
- **Flask backend:** splits the project across two languages.
- **Streamlit:** fast to start, but the UI looks generic and editable tables are awkward.
- **Local Gemma E2B via Ollama:** Challenge 01 requires the Gemini API, and the laptop has only 8GB RAM.

**Do not add other dependencies without asking first.**

---

## 5. Project structure

```
app/
  layout.tsx            fonts, metadata
  page.tsx              the single page, state lives here
  api/parse/route.ts    the only place Gemma is called
components/
  PastePanel.tsx
  MessageList.tsx       "How each message was read"
  OrderSheet.tsx
  Summary.tsx           totals, who owes what, copy/export buttons
lib/
  gemma.ts              SDK client + model name (from GEMMA_MODEL)
  prompt.ts             Gemma system prompt
  schema.ts             zod schema for Gemma output
  parseChat.ts          chat text -> messages (pure)
  aggregate.ts          results -> grouped order (pure)
  money.ts              ₹ formatting, totals, per-person split (pure)
  exports.ts            shop text, who-owes text, CSV (pure)
  sampleChat.ts         the demo fixture from section 17
```

Keep the model name and SDK client in `lib/gemma.ts`. A Next.js route file may only export HTTP handlers and route config.

---

## 6. Golden rule: who does what

- **Gemma does one small job.** It reads ONE message and returns structured JSON (section 7).
- **Plain code does everything else:**
  - splitting the chat
  - sender names and times
  - grouping
  - summing
  - applying cancellations
  - prices and per-person totals
  - exports
- **Gemma never invents items, quantities, or prices.** Prices are always typed by the organiser.

---

## 7. Data contract: Gemma's output for one message

```json
{
  "intent": "add",
  "items": [
    { "name": "notebook", "variant": "single line", "quantity": 2,
      "source": "2 copy chahiye single line wali" }
  ],
  "unclear": []
}
```

| Field | Rule |
|---|---|
| `intent` | One of `"add"`, `"cancel"`, `"not_an_order"`. |
| `items[].name` | Lowercase, singular, generic English product name. Never empty. |
| `items[].variant` | String or `null`. Only details that change what to buy: colour, size, ruling, brand. |
| `items[].quantity` | Positive integer or `null`. `null` whenever the message is vague. |
| `items[].source` | The exact words from the message that mention this item. |
| `unclear` | Array of short questions or notes for the organiser. |

---

## 8. Gemma integration requirements

- **Server only.** `app/api/parse/route.ts` receives `{ text }` and returns the validated result. The browser never sees the key or calls Gemma directly.
- **Key and model.** Read the key from `GEMINI_API_KEY` in `.env.local`. The developer creates that file; never ask for the key, print it, or log it. Read the model from `GEMMA_MODEL`, defaulting to `gemma-4-26b-a4b-it`.
- **Request settings** (all verified with this model in AI Studio before the event):
  - system instruction = the prompt from `lib/prompt.ts`
  - JSON response MIME type, plus a response schema matching section 7 (`variant` and `quantity` nullable)
  - low temperature (~0.2)
  - thinking level `MINIMAL` (the lowest this model accepts; `LOW` returns 400). *Tested at the event:* with thinking unset, Gemma repeated items, broke the JSON, and lost "packet" from "2 A4 sheet packet". `MINIMAL` fixed all three at the same speed (~2 s).
  - no Google Search grounding or other tools
- **One message, one fresh request.** Every call contains only the system instruction and the single message being read. Never send earlier messages or earlier answers as chat history. Testing showed earlier answers in the history make Gemma repeat its mistakes.
- **Fallback for unsupported settings.** If the API rejects the system instruction or JSON MIME type for this model, prepend the prompt to the message content instead, and rely on the cleanup step below.
- **Cleanup and validation, in order:**
  1. Strip any ```` ```json ```` fences and trim.
  2. `JSON.parse`.
  3. Convert numeric-string quantities to numbers.
  4. Validate with zod.
  5. On failure, retry once, adding "Return only valid JSON matching the schema."
  6. If it still fails, return a clear error the UI can show.
- **Ignore notes on chatter (code).** If `intent` is `not_an_order`, discard `unclear`. Gemma sometimes copies the message into it, e.g. a question like "kal tak aa jayega kya?".
- **Hallucination guard (code, not AI).** Check that each item's `source` appears in the original message, case-insensitive with whitespace normalised. If it doesn't, keep the item but add "Couldn't find this in the message — please check" to `unclear`.
- **Duplicate guard (code).** Drop items that are exact repeats (same name, variant, quantity, source) within one message.
- **Limits:**
  - Cap message text at 500 characters server-side.
  - The client sends one message per request, max 2 requests in parallel.
  - Server: the SDK's built-in retry (`retryOptions: { attempts: 3, initialDelay: 2 }`) covers 429, 5xx and network errors, with a 15 s timeout per attempt. *Tested at the event:* about 1 call in 7 got "500 Internal error" from Google, so one retry wasn't enough. Route `maxDuration` = 60.

---

## 9. Gemma prompt requirements

Write the actual prompt in `lib/prompt.ts` at the event. It must cover all of these.

**Language:**
- Messages may be English, Hindi, or Hinglish (Hindi in English letters).
- Indian English applies: "copy" means notebook.
- Translate Hindi product words to English names.

**Output:** only the JSON from section 7, nothing else.

**Intents:**
- `add`: wants something bought.
- `cancel`: taking back an earlier request.
- `not_an_order`: greetings, reactions, thanks, questions, chatter. Always with `items: []`.

**Quantities:**
- Only when stated or clearly implied: "a"/"an"/"ek" = 1, "do" = 2, "teen" = 3.
- Vague words ("some", "a few", "kuch") → `null`, plus a short question in `unclear`.
- **Always list every product the message names, even when the quantity is unknown** (use `quantity: null`). Never return empty `items` for a message that names a product. This applies to `cancel` too: list the items being cancelled.
  - *Found in pre-event testing:* without this rule, Gemma returned empty items for "some pens for me" and "actually cancel the copies."

**Naming:** keep the product type in `name` ("gel pen") and colour or size in `variant` ("blue"). The same product must always get the same `name`, so code can group it.

**Source:** copy the exact words. Never rephrase.

**Never invent** items, quantities, brands, or prices.

**References to someone else** ("same as Rahul", "mere liye bhi") → `add`, `items: []`, plus a note in `unclear`.

**Few-shot examples (most important part of the prompt):** in pre-event testing, Gemma ignored a written rule but followed a worked JSON example immediately. The prompt must end with full JSON examples (message + exact JSON output) covering at least:
- a vague quantity → item kept with `quantity: null` and a question in `unclear` (use `a few sticky notes pls`)
- a cancel that names the item → `cancel` with that item listed (use `scale cancel kar do`)
- chatter → `not_an_order` with `items: []` and `unclear: []` (use `thanks yaar`)
- *Added at the event:* a number + colour followed by a second colour that leaves out the product (`4 blue folders and 2 green`). With `MINIMAL` thinking, Gemma read "3 black pens and 1 red" as black ×1 five times out of five until this example was added.

Never use the section 17 demo messages as examples, or the demo proves nothing.

### Prompt test cases (all must pass before Phase 3)

| Message | Expected |
|---|---|
| `ek scale aur 2 eraser` | add → scale ×1, eraser ×2 |
| `thanks yaar` | not_an_order, no items |
| `a few sticky notes pls` | add → sticky note, quantity null, unclear asks how many |
| `mere liye bhi same` | add, no items, unclear note about the reference |
| `cancel my order` | cancel, no items |
| `3 black pens and 1 red` | add → pen (black) ×3, pen (red) ×1 |
| `bhai 2 copy chahiye single line wali` | add → notebook (single line) ×2 |
| `do pencil aur ek sharpener chahiye` | add → pencil ×2, sharpener ×1 |
| `kal tak aa jayega kya?` | not_an_order, no items |
| `pen nahi chahiye ab` | cancel → pen |

### Pre-event check results (AI Studio, `gemma-4-26b-a4b-it`, temperature low, thinking lowest, structured output on)

| Area | Result |
|---|---|
| Hinglish and Indian English | Worked first try: "ek"/"do", "copy" → notebook, "nahi chahiye" → cancel. |
| Vague quantities and cancels | Failed with rules alone, worked once a JSON example was added. |
| Chatter and questions | Correctly `not_an_order`. Sometimes puts the message in `unclear` (handled in code, section 8). |
| JSON shape | Structured output with a schema works for this model. |

---

## 10. Chat splitting rules (`lib/parseChat.ts`)

**Supported formats:**
- Android export: `03/10/26, 9:02 pm - Rahul: text`
- iOS export: `[03/10/26, 9:02:11 PM] Rahul: text`
- Short pasted format: `[03/10, 9:02 pm] Rahul: text`
- Fallback: plain `Name: text` lines

**Rules:**
- A line that doesn't start a new message continues the previous message.
- Skip these system lines:
  - the encryption notice
  - `<Media omitted>`
  - "joined", "left", "added", "removed"
  - "This message was deleted"
- If any line has a WhatsApp timestamp, only timestamped lines start messages (so "note: blue wale" stays a continuation). Plain `Name: text` is used only when no line has a timestamp.
- Strip the `<This message was edited>` tag. "Added"/"removed"/"left" lines are only skipped when they use contact names (capitalised, phone number, or "You"), so "pen removed kar do" is kept.
- Real exports contain invisible characters. Strip `U+200E` (iOS adds it at line starts) and treat `U+202F` / `U+00A0` (newer Android puts one before "pm") as a normal space. Test both.
- Output: `{ id, sender, time, text }[]` in chat order.

---

## 11. Combining rules (`lib/aggregate.ts`)

Process results in chat order:

| Intent | What happens |
|---|---|
| `add` | Append the items to that sender's requests. |
| `cancel` with items | Remove that sender's earlier items with the same `name`. |
| `cancel` with no items | Remove all of that sender's earlier items. |
| `not_an_order` | Ignore. |

**Edge cases:**
- A `cancel` that names items but matches none of that sender's earlier items (e.g. Gemma named it `copy` instead of `notebook`) → nothing is removed, and the message shows as "Needs a check". Never fail silently.
- An `add` with no items but a note (e.g. "mere liye bhi same") creates no row. It shows only in the message list as "Needs a check". Fixing it needs manual row adding (nice-to-have).

**Grouping:**
- Group key = `name + variant`, lowercased and trimmed.
- Each group stores:
  - total quantity (non-null quantities only)
  - a list of `{ sender, quantity, source, messageId }`
  - a `flagged` boolean, true if any entry has a null quantity or an `unclear` note
- A note belongs to the items it mentions ("How many pens?" → pen). A note that mentions none of the message's items belongs to all of them. A quantity the organiser types clears that entry's flag.

**Money (`lib/money.ts`):**
- Line total = total quantity × unit price.
- Per person owed = Σ (their quantity × unit price).
- Entries with a null quantity count for nothing until fixed.
- Format as ₹ with the `en-IN` locale.

---

## 12. UI (one page, mobile-first: organisers are usually on their phone)

1. **Header.** App name and one line: "Paste your group chat. Get one clean order."
2. **Paste panel:**
   - textarea
   - "Load sample chat" button
   - "Upload chat export" (.txt, nice-to-have)
   - "Build order" button
   - progress text: "Reading message 4 of 7"
3. **How each message was read.** Collapsible. Each message shows sender, text, and status: Added / Cancelled / Ignored / Needs a check / Couldn't read (with Retry).
4. **Order sheet:**
   - One row per group: item and variant, total quantity, unit price input (₹), line total.
   - Expanding a row shows each person's quantity and exact quote.
   - Flagged rows are highlighted. The inline quantity input sits on each person's entry that has no quantity (a row can hold several people), shown without needing to expand the row.
5. **Summary:**
   - grand total
   - who owes what
   - "Copy order for shop" button
   - (nice-to-have) "Copy who owes what" and "Download CSV"
   - After copying, show "Copied."
   - `navigator.clipboard` only works on https or localhost. When it's missing (e.g. a phone opening `http://192.168.x.x:3000`), fall back to a hidden textarea + `document.execCommand("copy")`.

**Copy formats:**
```
Group order — 4 items
• Notebook (single line) × 2
• Gel pen (blue) × 3
• Geometry box × 1
• A4 sheet packet × 2
```
```
Who owes what
Aman: ₹230
Karan: ₹110
```

**Decided at the event:**
- The shop text leaves out rows with no known quantity (the shop can't fill "× ?"). After copying, the app says how many were left out.
- Only the latest 60 messages of a chat are read (each one is a Gemma request, about 1 per second). The app explains this when it happens.
- Work is saved in `localStorage` (`buy-together-v1`). "Start over" clears it.

**Empty and error states tell the user what to do next:**
- "Paste a chat or load the sample to start."
- "Couldn't read this message. Retry or add it by hand."

---

## 13. Design direction

- **The one memorable element:** the order sheet looks like a page from a single-line school notebook ("copy"). White paper, faint blue ruled lines, a red margin line on the left. Keep everything else quiet.
- **Flagged items:** look marked with a yellow highlighter.
- **Fonts:** both from Google Fonts, both by Indian Type Foundry, both with Devanagari support.
  - **Hind** for all UI text.
  - **Kalam** only for item names on the order sheet.
- **Palette:**

| Role | Hex |
|---|---|
| Page background | `#EEF2F7` |
| Paper | `#FFFFFF` |
| Ink | `#1E2A55` |
| Ruled line | `#BCD0EA` |
| Margin red | `#D64545` |
| Highlighter | `#FFEB6B` |

- **Avoid:** gradients, grids of identical cards, all-caps labels.
- **Always:** sentence case, visible keyboard focus, respect for reduced motion, readable down to a 360px screen width.

---

## 14. Build phases

Do ONE phase at a time. At the end of each phase:
1. Run the checks listed.
2. Commit with a clear message.
3. Tell the developer how to test it in 3 steps or fewer.
4. Wait for "next."

**Time targets (hours from the start of hacking):**

| Phase | Done by |
|---|---|
| 0 | 0:30 |
| 1 | 2:00 |
| 2 | 2:45 |
| 3 | 4:30 |
| 4 | 6:00 |
| 5 | 7:00 |
| 6 | 8:15 |
| 7 | 9:00 |

The last hour is for the demo, submission, and buffer. If a phase runs more than 30 minutes over, say so and suggest what to cut.

| # | Phase | Done when |
|---|---|---|
| 0 | `git init`; commit this spec; scaffold with `create-next-app` (TypeScript, Tailwind, App Router, ESLint, no `src/` dir); install `@google/genai`, `zod`, `vitest`; confirm `.env.local` is gitignored | `npm run dev` shows the starter page. `.env.local` isn't in `git status`. |
| 1 | `lib/gemma.ts`, `lib/schema.ts`, `lib/prompt.ts`, `/api/parse`, plus a temporary `/dev` page to send one message and show the JSON | All 10 prompt test cases in section 9 return the expected result. |
| 2 | `lib/parseChat.ts` + `lib/sampleChat.ts` + vitest tests for all four chat formats and continuation lines | `npx vitest run` passes. |
| 3 | Processing loop with progress, `lib/aggregate.ts` + tests, basic message list and order table | The sample chat produces the expected result in section 17. |
| 4 | Flag fixing, prices, `lib/money.ts` + tests, totals, who owes what | Typing prices updates every total correctly. |
| 5 | Copy order for shop (then the nice-to-haves from section 3, if on schedule) | The copied text matches the section 12 format. |
| 6 | Design pass from section 13, mobile layout, empty/error states; delete the `/dev` page | Looks right at 360px and on desktop. `npm run build` passes. |
| 7 | README, MIT `LICENSE`, deploy notes | Section 16 checklist complete. |

---

## 15. Working rules for Claude Code

- Follow this spec. If something in it seems wrong, say so and propose a fix. Don't silently deviate.
- Keep changes small and focused on the current phase. Don't refactor unrelated code.
- Before saying a phase is done, run `npm run lint`, `npx vitest run` (from Phase 2), and `npm run build` (from Phase 4).
- If the same error happens twice, stop. Explain the cause and give two options instead of retrying in a loop.
- Never read, print, or edit the contents of `.env.local`.
- This is Next.js 16, which has breaking changes from older versions. Before writing Next-specific code, read the relevant guide in `node_modules/next/dist/docs/` (see `AGENTS.md`).
- Don't delete `AGENTS.md`. If it's missing, `next dev` writes its own block into this file.
- Commit after every phase. The commit history shows the work was done during the event.
- Prefer simple, readable code over clever code. The developer must be able to explain it to judges.

---

## 16. README and submission requirements

The README must include:
- What it does, the problem it solves, and a screenshot or GIF.
- A **Gemma model used** section: `gemma-4-26b-a4b-it` (Gemma 4 26B A4B) via the Gemini API, and where it's integrated (`lib/gemma.ts`, `lib/prompt.ts`, `app/api/parse/route.ts`).
- A **"What Gemma does vs what code does"** section, in 4–6 lines.
- An **AI usage credit** section (required by MLH): the app uses Gemma 4 at runtime, and the code was built with help from Claude Code (Anthropic).
- **Setup:**
  1. clone
  2. `npm install`
  3. create `.env.local` with `GEMINI_API_KEY` (optionally `GEMMA_MODEL`)
  4. `npm run dev`
- Live demo link (Vercel).
- License: MIT.

---

## 17. Sample chat fixture (`lib/sampleChat.ts`)

```
[03/10, 9:02 pm] Rahul: bhai 2 copy chahiye single line wali
[03/10, 9:04 pm] Priya: some pens for me
[03/10, 9:05 pm] Aman: 1 geometry box and 3 blue gel pens
[03/10, 9:06 pm] Sneha: ok 👍
[03/10, 9:08 pm] Karan: mujhe ek register aur 2 notebook
[03/10, 9:10 pm] Rahul: actually cancel the copies, I found mine
[03/10, 9:11 pm] Neha: 2 A4 sheet packet pls
```

**Expected result:**

| Sender | Result |
|---|---|
| Rahul | Notebooks cancelled; nothing left. |
| Priya | Pens, quantity unknown, flagged. |
| Aman | Geometry box × 1, gel pen (blue) × 3. |
| Sneha | Ignored. |
| Karan | Register × 1, notebook × 2. |
| Neha | A4 sheet packet × 2. |
