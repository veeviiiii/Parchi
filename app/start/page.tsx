"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import AppHeader from "@/components/AppHeader";
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from "@/components/styles";
import { saveProfile, useProfile } from "@/lib/profile";
import { NAME_LABEL, ROLE_LABEL, ROLE_PITCH, ROLES, type Role } from "@/lib/roles";

// Where to go after choosing: ?next=/crowdmind (only paths on this site).
function nextPath(): string {
  const next = new URLSearchParams(window.location.search).get("next") ?? "/crowdmind";
  return next.startsWith("/") && !next.startsWith("//") ? next : "/crowdmind";
}

// Who are you? The choice shapes Crowdmind (which space you read) and bills (who they're from and to).
export default function StartPage() {
  const router = useRouter();
  const { profile, ready } = useProfile();
  const [changing, setChanging] = useState(false);
  const [role, setRole] = useState<Role | null>(null);
  const [name, setName] = useState("");

  function startChange() {
    setChanging(true);
    setRole(profile?.role ?? null);
    setName(profile?.name ?? "");
  }

  function save() {
    if (!role || !name.trim()) return;
    saveProfile({ role, name });
    router.push(nextPath());
  }

  const showPicker = ready && (!profile || changing);

  return (
    <>
      <AppHeader profile={null} />
      <main className="mx-auto w-full max-w-2xl px-4 py-10 sm:py-16">
        <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">Who are you?</h1>
        <p className="mt-2 text-lg text-muted">
          Parchi is for everyone. Your role decides which Crowdmind space you read, and who your bills are from and to.
        </p>

        {ready && profile && !changing && (
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => router.push(nextPath())} className={PRIMARY_BUTTON}>
              Continue as {profile.name} ({ROLE_LABEL[profile.role]})
            </button>
            <button type="button" onClick={startChange} className={SECONDARY_BUTTON}>
              Change
            </button>
          </div>
        )}

        {showPicker && (
          <form
            className="mt-8"
            onSubmit={(e) => {
              e.preventDefault();
              save();
            }}
          >
            <fieldset>
              <legend className="mb-3 font-bold">Pick one</legend>
              <div className="grid gap-2">
                {ROLES.map((r) => (
                  <label
                    key={r}
                    className={`flex min-h-11 cursor-pointer items-start gap-3 rounded-2xl border p-4 ${
                      role === r ? "border-accent bg-paper" : "border-rule bg-paper/60"
                    }`}
                  >
                    <input type="radio" name="role" value={r} checked={role === r} onChange={() => setRole(r)} className="mt-1.5" />
                    <span>
                      <span className="block font-bold">{ROLE_LABEL[r]}</span>
                      <span className="block text-muted">{ROLE_PITCH[r]}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            {role && (
              <div className="mt-5">
                <label htmlFor="profile-name" className="mb-1 block font-bold">
                  {NAME_LABEL[role]}
                </label>
                <input
                  id="profile-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={40}
                  required
                  autoComplete="off"
                  className="w-full rounded-xl border border-rule bg-paper p-3 text-base"
                />
                <button type="submit" disabled={!name.trim()} className={`${PRIMARY_BUTTON} mt-4`}>
                  Continue
                </button>
              </div>
            )}
          </form>
        )}
      </main>
    </>
  );
}
