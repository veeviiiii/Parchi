"use client";

import AppHeader from "@/components/AppHeader";
import Builder from "@/components/Builder";
import { useProfile } from "@/lib/profile";

// The whole app: paste a chat, Gemma reads it, get one clean order, prices, and bills.
export default function BuildPage() {
  const { profile } = useProfile();
  return (
    <div className="pl">
      <AppHeader profile={profile} />
      <main>
        <Builder profile={profile} />
      </main>
    </div>
  );
}
