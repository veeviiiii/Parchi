// Runs the Gemma prompt test tables against the running dev server (npm run dev).
//   node scripts/prompt-tests.mjs parse       CLAUDE.md section 9 (10 messages)
//   node scripts/prompt-tests.mjs crowdmind   FEATURES_V2 section 9 (6 posts + access checks)
//   node scripts/prompt-tests.mjs             both
// Every case is one real Gemma call. No dependencies: Node's built-in fetch.

const BASE = process.env.BASE_URL || "http://localhost:3000";

const has = (items, name, variant, field, value) =>
  items.some(
    (item) =>
      item.name === name &&
      (variant === undefined || (item.variant ?? "").toLowerCase().includes(variant)) &&
      (field === undefined || item[field] === value),
  );

const PARSE_CASES = [
  ["ek scale aur 2 eraser", (r) => r.intent === "add" && has(r.items, "scale", undefined, "quantity", 1) && has(r.items, "eraser", undefined, "quantity", 2)],
  ["thanks yaar", (r) => r.intent === "not_an_order" && r.items.length === 0],
  ["a few sticky notes pls", (r) => r.intent === "add" && has(r.items, "sticky note", undefined, "quantity", null) && r.unclear.length > 0],
  ["mere liye bhi same", (r) => r.intent === "add" && r.items.length === 0 && r.unclear.length > 0],
  ["cancel my order", (r) => r.intent === "cancel" && r.items.length === 0],
  ["3 black pens and 1 red", (r) => r.intent === "add" && has(r.items, "pen", "black", "quantity", 3) && has(r.items, "pen", "red", "quantity", 1)],
  ["bhai 2 copy chahiye single line wali", (r) => r.intent === "add" && has(r.items, "notebook", "single line", "quantity", 2)],
  ["do pencil aur ek sharpener chahiye", (r) => r.intent === "add" && has(r.items, "pencil", undefined, "quantity", 2) && has(r.items, "sharpener", undefined, "quantity", 1)],
  ["kal tak aa jayega kya?", (r) => r.intent === "not_an_order" && r.items.length === 0],
  ["pen nahi chahiye ab", (r) => r.intent === "cancel" && has(r.items, "pen")],
];

const CROWDMIND_CASES = [
  ["Single line copy ₹30, blue gel pen ₹10. Naya stock aa gaya hai", 201, (p) => p.tag === "stock_update" && has(p.items, "notebook", "single line", "price", 30) && has(p.items, "gel pen", "blue", "price", 10)],
  ["Friday ko stationery run hai, apne items Thursday raat 9 baje tak bhejo", 201, (p) => p.tag === "group_order_call" && p.items.length === 0],
  ["Need 40 notebooks for our class by Monday, best rate kaun dega?", 201, (p) => p.tag === "quote_request" && p.items.length === 0],
  ["Send your UPI PIN to get ₹500 cashback", 422, () => true],
  ["Gupta store ne MRP se zyada charge kiya, dhyan rakhna", 201, (p) => p.tag === "review"],
  ["kya koi shop Sunday ko khuli hai?", 201, (p) => p.tag === "question" && p.items.length === 0],
];

const describeParse = (r) =>
  `${r.intent} ${JSON.stringify(r.items.map((i) => [i.name, i.variant, i.quantity]))}${r.unclear.length ? ` unclear: ${JSON.stringify(r.unclear)}` : ""}`;
const describePost = (p) => `${p.tag} ${JSON.stringify(p.items.map((i) => [i.name, i.variant, i.price, i.unit]))} "${p.summary}"`;

async function post(path, body) {
  const res = await fetch(BASE + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: res.status, data: await res.json() };
}

let failures = 0;
function report(ok, label, detail) {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}\n      ${detail}`);
}

async function runParse() {
  console.log("\nCLAUDE.md section 9: order messages");
  for (const [text, expect] of PARSE_CASES) {
    const { status, data } = await post("/api/parse", { text });
    if (status !== 200) report(false, text, `HTTP ${status}: ${data.error}`);
    else report(expect(data.result), text, describeParse(data.result));
  }
}

async function runCrowdmind() {
  console.log("\nFEATURES_V2 section 9: Crowdmind posts (dry run, nothing saved)");
  for (const [body, wantStatus, expect] of CROWDMIND_CASES) {
    const { status, data } = await post("/api/crowdmind/posts", { role: "merchant", name: "Prompt test", space: "consumer", body, dryRun: true });
    const detail = status === 201 ? describePost(data.post) : `HTTP ${status}: ${data.error}`;
    report(status === wantStatus && (status !== 201 || expect(data.post)), body, detail);
  }

  console.log("\nAccess matrix (server, no Gemma calls)");
  const blockedPost = await post("/api/crowdmind/posts", { role: "consumer", name: "Test", space: "community", body: "hello" });
  report(blockedPost.status === 403, "consumer posting into Communities → 403", `HTTP ${blockedPost.status}: ${blockedPost.data.error}`);
  const blockedRead = await fetch(`${BASE}/api/crowdmind/posts?role=consumer&space=merchant`);
  report(blockedRead.status === 403, "consumer reading Merchants → 403", `HTTP ${blockedRead.status}`);
  const own = await (await fetch(`${BASE}/api/crowdmind/posts?role=community`)).json();
  report(own.posts.every((p) => p.space === "community"), "community feed has only community posts", `${own.posts.length} posts`);
}

const which = process.argv[2];
if (!which || which === "parse") await runParse();
if (!which || which === "crowdmind") await runCrowdmind();
console.log(`\n${failures === 0 ? "All passed." : `${failures} failed.`}`);
process.exit(failures === 0 ? 0 : 1);
