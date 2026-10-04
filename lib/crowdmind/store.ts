// Where Crowdmind posts live. Server-side only.
// Memory mode: posts are kept in the server's memory, starting with the seed posts.
// They reset when the server restarts (Supabase was cut for time; FEATURES_V2 section 12).
import type { Role } from "../roles";
import type { Post } from "./schema";
import { seedPosts } from "./seed";

export const DEMO_MODE = true;
const MAX_POSTS = 200;

// Kept on globalThis so the dev server's hot reloads don't wipe the posts.
const memory = globalThis as typeof globalThis & { parchiPosts?: Post[] };
const allPosts = () => (memory.parchiPosts ??= seedPosts());

// One space's posts, newest first.
export function listPosts(space: Role): Post[] {
  return allPosts()
    .filter((post) => post.space === space)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function addPost(post: Post) {
  const posts = allPosts();
  posts.unshift(post);
  if (posts.length > MAX_POSTS) posts.length = MAX_POSTS;
}
