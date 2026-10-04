"use client";

import AppHeader from "@/components/AppHeader";
import RoleGate from "@/components/RoleGate";
import { SPACE_LABEL } from "@/lib/roles";

// Placeholder until N4 builds the feed.
export default function CrowdmindPage() {
  return (
    <RoleGate>
      {(profile) => (
        <>
          <AppHeader profile={profile} />
          <main className="mx-auto w-full max-w-2xl px-4 py-6">
            <h1 className="text-3xl font-semibold">Crowdmind</h1>
            <p className="mt-2">The {SPACE_LABEL[profile.role]} space is coming soon.</p>
          </main>
        </>
      )}
    </RoleGate>
  );
}
