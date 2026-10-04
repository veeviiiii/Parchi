import type { NextRequest } from "next/server";
import { checkPost } from "@/lib/crowdmind/checkPost";
import type { Post } from "@/lib/crowdmind/schema";
import { addPost, DEMO_MODE, listPosts } from "@/lib/crowdmind/store";
import { MissingKeyError } from "@/lib/gemma";
import { canPost, canRead, isRole, ROLE_LABEL, SPACE_LABEL, type Role } from "@/lib/roles";

// Worst case: Gemma's 3 attempts of up to 15 s each, plus the waits between them.
export const maxDuration = 60;

const MAX_BODY = 500;

// The access matrix (lib/roles.ts) is checked here, on the server, on every request.
// Roles are self-chosen for the demo, so this checks the role the browser claims.
function forbidden(role: Role, space: Role, action: string) {
  const error = `As a ${ROLE_LABEL[role].toLowerCase()}, you can't ${action} the ${SPACE_LABEL[space]} space.`;
  return Response.json({ error }, { status: 403 });
}

// GET ?role=consumer[&space=consumer] → that space's posts, newest first.
export function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const role = params.get("role");
  const space = params.get("space") ?? role;
  if (!isRole(role) || !isRole(space)) {
    return Response.json({ error: "Pick a role first." }, { status: 400 });
  }
  if (!canRead(role, space)) return forbidden(role, space, "read");
  return Response.json({ posts: listPosts(space), demo: DEMO_MODE });
}

// POST { role, name, space, body } → Gemma checks the post → saved, or 422 with a reason.
// `dryRun: true` (used by scripts/prompt-tests.mjs) checks the post without saving it.
export async function POST(request: NextRequest) {
  let input: Record<string, unknown> = {};
  try {
    input = await request.json();
  } catch {
    // Not JSON: handled by the checks below.
  }
  const { role, space } = input;
  const name = typeof input.name === "string" ? input.name.trim().slice(0, 40) : "";
  const body = typeof input.body === "string" ? input.body.trim() : "";

  // 1. Validate the body.
  if (!isRole(role) || !isRole(space) || !name || !body) {
    return Response.json({ error: "Send { role, name, space, body }." }, { status: 400 });
  }
  if (body.length > MAX_BODY) {
    return Response.json({ error: `Posts can be at most ${MAX_BODY} characters.` }, { status: 400 });
  }

  // 2. Check the access matrix.
  if (!canPost(role, space)) return forbidden(role, space, "post in");

  // 3. Ask Gemma. If it fails after its retries, don't publish (fail closed).
  let check;
  try {
    check = await checkPost(body);
  } catch (err) {
    if (err instanceof MissingKeyError) return Response.json({ error: err.message }, { status: 500 });
    console.error("[api/crowdmind]", err instanceof Error ? err.message : err); // never the key or the post
    return Response.json({ error: "Couldn't check this post right now. Try again." }, { status: 503 });
  }

  // 4. Not allowed: say why, save nothing.
  if (!check.moderation.allowed) {
    return Response.json({ error: check.moderation.reason }, { status: 422 });
  }

  // 5. Save it with Gemma's tag, summary, and prices.
  const post: Post = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    space,
    authorName: name,
    authorRole: role,
    body,
    tag: check.tag,
    summary: check.summary,
    items: check.items,
  };
  if (input.dryRun !== true) addPost(post);
  return Response.json({ post }, { status: 201 });
}
