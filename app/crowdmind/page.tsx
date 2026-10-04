"use client";

import { useEffect, useState } from "react";
import AppHeader from "@/components/AppHeader";
import RoleGate from "@/components/RoleGate";
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from "@/components/styles";
import { TAG_LABEL, type Post } from "@/lib/crowdmind/schema";
import { itemLabel } from "@/lib/exports";
import { formatRupees } from "@/lib/money";
import type { Profile } from "@/lib/profile";
import { postableSpaces, ROLE_LABEL, SPACE_LABEL, type Role } from "@/lib/roles";

const MAX_BODY = 500;
const POLL_MS = 20_000;

// "just now", "5 min ago", "3 h ago", "2 d ago"
function timeAgo(iso: string, now: number): string {
  const minutes = Math.floor((now - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 60 * 24) return `${Math.floor(minutes / 60)} h ago`;
  return `${Math.floor(minutes / (60 * 24))} d ago`;
}

// /crowdmind needs a role: no profile → back to the landing page.
export default function CrowdmindPage() {
  return (
    <RoleGate>
      {(profile) => (
        <>
          <AppHeader profile={profile} />
          <Crowdmind profile={profile} />
        </>
      )}
    </RoleGate>
  );
}

type Feed = { posts: Post[]; demo: boolean; loadedAt: number };

function Crowdmind({ profile }: { profile: Profile }) {
  const [feed, setFeed] = useState<Feed | null>(null);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const spaces = postableSpaces(profile.role);
  const [space, setSpace] = useState<Role>(profile.role);
  const [body, setBody] = useState("");
  const [posting, setPosting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // Load this role's space now, on Refresh, and quietly every 20 s while the tab is visible.
  // The server only ever sends the role's own space.
  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const res = await fetch(`/api/crowdmind/posts?role=${profile.role}`, { cache: "no-store" });
        const data = await res.json();
        if (!alive) return;
        if (res.ok) {
          setFeed({ posts: data.posts, demo: data.demo, loadedAt: Date.now() });
          setFeedError(null);
        } else {
          setFeedError(data.error ?? "Couldn't load posts. Try Refresh.");
        }
      } catch {
        if (alive) setFeedError("Couldn't load posts. Check your connection, then try Refresh.");
      }
    }
    load();
    const timer = setInterval(() => {
      if (!document.hidden) load();
    }, POLL_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [profile.role, refreshKey]);

  async function submit() {
    if (!body.trim() || posting) return;
    setPosting(true);
    setNotice(null);
    try {
      const res = await fetch("/api/crowdmind/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: profile.role, name: profile.name, space, body }),
      });
      const data = await res.json();
      if (res.ok) {
        setBody("");
        const label = SPACE_LABEL[space];
        setNotice(
          space === profile.role
            ? "Posted."
            : `Posted to ${label}. Only ${label.toLowerCase()} can read that space, so it won't show here.`,
        );
        setRefreshKey((key) => key + 1);
      } else if (res.status === 422) {
        setNotice(`Not posted. ${data.error}`);
      } else {
        setNotice(data.error ?? "Couldn't post. Try again.");
      }
    } catch {
      setNotice("No connection. Check your internet, then try again.");
    }
    setPosting(false);
  }

  const ownLabel = SPACE_LABEL[profile.role];

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-6">
      <h1 className="text-3xl font-semibold">Crowdmind</h1>
      <p className="text-lg">
        The {ownLabel} space. Only {ownLabel.toLowerCase()} can read it. Gemma tags each post, sums it up, and stops
        scams.
      </p>

      <form
        className="mt-6 rounded-lg bg-paper p-4 shadow-sm"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <label htmlFor="post-body" className="mb-1 block font-semibold">
          New post
        </label>
        <textarea
          id="post-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={MAX_BODY}
          rows={3}
          placeholder="e.g. Single line copy ₹30, naya stock aa gaya"
          className="w-full rounded border border-rule bg-paper p-2 text-base"
        />
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <label htmlFor="post-space" className="font-semibold">
            Post to
          </label>
          <select
            id="post-space"
            value={space}
            onChange={(e) => setSpace(e.target.value as Role)}
            className="min-h-11 rounded border border-rule bg-paper px-2"
          >
            {spaces.map((s) => (
              <option key={s} value={s}>
                {SPACE_LABEL[s]}
              </option>
            ))}
          </select>
          <span className="text-sm">
            {body.length}/{MAX_BODY}
          </span>
          <button type="submit" disabled={posting || !body.trim()} className={`${PRIMARY_BUTTON} ml-auto`}>
            {posting ? "Gemma is checking…" : "Post"}
          </button>
        </div>
        <p className="mt-2 min-h-6" role="status">
          {notice}
        </p>
      </form>

      <div className="mt-6 flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">Latest</h2>
        <button type="button" onClick={() => setRefreshKey((key) => key + 1)} className={SECONDARY_BUTTON}>
          Refresh
        </button>
      </div>
      {feed?.demo && <p className="mt-1 text-sm">Demo mode: posts reset on restart.</p>}
      {feedError && (
        <p className="mt-2" role="alert">
          {feedError}
        </p>
      )}
      {!feed && !feedError && <p className="mt-2">Loading…</p>}
      {feed && feed.posts.length === 0 && <p className="mt-2">No posts here yet. Be the first.</p>}

      <ul className="mt-3 flex flex-col gap-3">
        {feed?.posts.map((post) => (
          <li key={post.id} className="rounded-lg bg-paper p-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
              <span className="text-base font-semibold break-words">{post.authorName}</span>
              <span className="rounded bg-page px-1.5">{ROLE_LABEL[post.authorRole]}</span>
              <span>· {timeAgo(post.createdAt, feed.loadedAt)}</span>
              <span className="ml-auto rounded-full border border-ink px-2">{TAG_LABEL[post.tag]}</span>
            </div>
            <p className="mt-2 whitespace-pre-wrap break-words">{post.body}</p>
            {post.summary && (
              <p className="mt-2 text-sm">
                <span className="font-semibold">Gemma:</span> {post.summary}
              </p>
            )}
            {post.items.length > 0 && (
              <ul className="mt-2 text-sm">
                {post.items.map((item) => (
                  <li key={item.source}>
                    {itemLabel(item.name, item.variant)}: {formatRupees(item.price)}
                    {item.unit ? ` per ${item.unit}` : ""}
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}
