"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useProfile, type Profile } from "@/lib/profile";

// Pages that need a role: no profile → back to the landing page to pick one.
export default function RoleGate({ children }: { children: (profile: Profile) => ReactNode }) {
  const { profile, ready } = useProfile();
  const router = useRouter();

  useEffect(() => {
    if (ready && !profile) router.replace("/");
  }, [ready, profile, router]);

  if (!profile) return <p className="p-6">Loading…</p>;
  return children(profile);
}
