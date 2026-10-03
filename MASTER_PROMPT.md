# Buy Together — Hack Day master prompt

How to use this file:
1. Open the `buy-together` folder in the Code tab of the Claude desktop app. `CLAUDE.md` and `.env.local` should already be in it.
2. Paste the master prompt below as your first message.
3. Use the follow-up prompts whenever you need them.

---

## Master prompt (paste this first)

```
You're my pair programmer for a 10-hour hackathon: MLH Hack Day, Challenge 01 "Best Use of Gemma 4". I'm a student, so explain what you're doing in short, plain language as you go.

Step 1: Read CLAUDE.md in this folder, all of it. It's the source of truth for the product, scope, tech stack, Gemma integration, build phases, and working rules. Don't change the tech stack or add dependencies without asking me.

Step 2: Before writing any code, reply with:
(a) what we're building, in 5 lines, in your own words
(b) anything in CLAUDE.md that looks wrong, risky, or unclear
(c) the exact commands you'll run for Phase 0
Then wait for me to say "go".

How we work for the rest of the day:
- One phase at a time, from section 14. At the start of each phase, tell me the phase number, what you'll build, and its time target.
- At the end of each phase, run the checks from section 15, commit, tell me how to test it in 3 steps or fewer, then wait for "next".
- Protect the MVP line in section 3. If we're falling behind, tell me what to cut. Don't quietly skip things.
- I created .env.local myself with GEMINI_API_KEY. Never read, print, or edit it.
- If the same error happens twice, stop and give me two options instead of retrying in a loop.
- Keep the code simple enough that I can explain it to the judges.
```

---

## Follow-up prompts

### Move on
```
next
```

### Gemma got a message wrong
```
Gemma got this message wrong:
Message: [paste the message]
It returned: [paste the JSON]
Expected: [what it should be]
Fix the prompt in lib/prompt.ts so this case works, without breaking the other test cases in section 9 of CLAUDE.md. Then re-run all of them and show me the results.
```

### Something broke
```
This happened: [paste the full error, or describe what you saw]
Find the cause before changing any code. Explain it to me in 2 lines, then fix it.
```

### Falling behind
```
It's [time]. We're on Phase [N]. Re-plan the remaining time so the MVP line in section 3 is guaranteed. Tell me exactly what to cut and what's left.
```

### UI looks generic
```
Compare the current UI to section 13 of CLAUDE.md. List what doesn't match, then fix the 3 most important differences.
```

### Judge test before the demo
```
Pretend you're a judge. Walk through the sample chat end to end: load it, build the order, fix the flag, enter prices, copy for the shop. List anything broken, slow, or confusing, most important first. Don't fix anything yet.
```

### Push to GitHub and deploy
```
Help me put this on GitHub as a public repo and deploy it on Vercel. Check that .env.local is not tracked first. Tell me exactly what to click in the GitHub and Vercel websites, and which environment variables to add in Vercel (GEMINI_API_KEY, and optionally GEMMA_MODEL).
```

### Write the submission
```
Write our hackathon submission text. Sections: Inspiration, What it does, How we built it, Challenges, What's next. Under 300 words, plain language. Name the model (gemma-4-26b-a4b-it via the Gemini API), explain what Gemma does vs what code does, and credit Claude Code as a build tool.
```

---

## Demo script (2 minutes)

| Time | Beat | What to do and say |
|---|---|---|
| 15s | Problem | "Every hostel or class group collects orders like this by hand: Hinglish, vague, people changing their minds." Show the messy chat. |
| 30s | Gemma reads it | Click "Load sample chat," then "Build order." Point out three things: "copy" became notebook, Sneha's "ok 👍" was ignored, and Rahul's cancellation removed his notebooks. |
| 15s | No guessing | Show Priya's highlighted row: "Gemma doesn't invent a number. It asks." Fix it inline. |
| 20s | The maths | Type in prices. "Who owes what" updates instantly. "All the maths is plain code. Gemma only does the language." |
| 15s | The payoff | Click "Copy order for shop" and paste it into WhatsApp. |
| 15s | Close | "Gemma 4 26B A4B through the Gemini API, named in our README, fully open source." |
