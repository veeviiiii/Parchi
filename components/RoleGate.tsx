"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useProfile, type Profile } from "@/lib/profile";

// Pages that need a role: no profile → pick one on /start, then come back here.
export default function RoleGate({ children }: { children: (profile: Profile) => ReactNode }) {
  const { profile, ready } = useProfile();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (ready && !profile) router.replace(`/start?next=${encodeURIComponent(pathname)}`);
  }, [ready, profile, router, pathname]);

  if (!profile) return <p className="p-6">Loading…</p>;
  return children(profile);
}
