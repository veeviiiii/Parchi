// Where Crowdmind posts live. Server-side only. One interface, two implementations:
// - Supabase, when SUPABASE_URL and SUPABASE_SECRET_KEY are both set (posts persist).
// - Memory, otherwise: the server's memory, starting with the seed posts. Resets on restart.
import { createClient } from "@supabase/supabase-js";
import type { Role } from "../roles";
import { TAGS, type Post, type Tag } from "./schema";
import { seedPosts } from "./seed";

export type NewPost = Omit<Post, "id" | "createdAt">;

type PostStore = {
  mode: "supabase" | "memory";
  list(space: Role): Promise<Post[]>; // newest first
  add(post: NewPost): Promise<Post>;
};

const FEED_SIZE = 50;

// ---- Memory ----

const MAX_POSTS = 200;
// Kept on globalThis so the dev server's hot reloads don't wipe the posts.
const memory = globalThis as typeof globalThis & { parchiPosts?: Post[] };
const allPosts = () => (memory.parchiPosts ??= seedPosts());

const memoryStore: PostStore = {
  mode: "memory",
  async list(space) {
    return allPosts()
      .filter((post) => post.space === space)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, FEED_SIZE);
  },
  async add(newPost) {
    const post: Post = { ...newPost, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
    const posts = allPosts();
    posts.unshift(post);
    if (posts.length > MAX_POSTS) posts.length = MAX_POSTS;
    return post;
  },
};

// ---- Supabase (table and seed rows: the SQL in FEATURES_V2 section 9) ----

type Row = {
  id: string;
  created_at: string;
  space: Role;
  author_name: string;
  author_role: Role;
  body: string;
  tag: string;
  summary: string | null;
  items: Post["items"] | null;
};

// Database column names → the app's names.
const fromRow = (row: Row): Post => ({
  id: row.id,
  createdAt: row.created_at,
  space: row.space,
  authorName: row.author_name,
  authorRole: row.author_role,
  body: row.body,
  tag: TAGS.includes(row.tag as Tag) ? (row.tag as Tag) : "other",
  summary: row.summary ?? "",
  items: Array.isArray(row.items) ? row.items : [],
});

function supabaseStore(url: string, secretKey: string): PostStore {
  // The secret key bypasses row level security, so it must never reach the browser.
  const db = createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
  return {
    mode: "supabase",
    async list(space) {
      const { data, error } = await db
        .from("posts")
        .select("*")
        .eq("space", space)
        .order("created_at", { ascending: false })
        .limit(FEED_SIZE);
      if (error) throw new Error(`Supabase list failed: ${error.message}`);
      return (data as Row[]).map(fromRow);
    },
    async add(post) {
      const { data, error } = await db
        .from("posts")
        .insert({
          space: post.space,
          author_name: post.authorName,
          author_role: post.authorRole,
          body: post.body,
          tag: post.tag,
          summary: post.summary,
          items: post.items,
        })
        .select()
        .single();
      if (error) throw new Error(`Supabase insert failed: ${error.message}`);
      return fromRow(data as Row);
    },
  };
}

// Chosen once, on first use.
let store: PostStore | undefined;
export function getStore(): PostStore {
  if (!store) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SECRET_KEY;
    store = url && key ? supabaseStore(url, key) : memoryStore;
  }
  return store;
}
