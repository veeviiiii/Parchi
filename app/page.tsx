"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import ParchiMark from "@/components/ParchiMark";
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from "@/components/styles";
import { saveProfile, useProfile } from "@/lib/profile";
import { NAME_LABEL, ROLE_LABEL, ROLE_PITCH, ROLES, type Role } from "@/lib/roles";

// Landing: who are you? The choice shapes the order builder and Crowdmind.
export default function Landing() {
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
    router.push("/order");
  }

  const showPicker = ready && (!profile || changing);

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10 sm:py-16">
      <ParchiMark size="lg" />
      <h1 className="mt-6 text-3xl font-semibold sm:text-4xl">Parchi for everyone</h1>
      <p className="mt-2 text-lg">
        Paste a messy chat. Get a clean order, a proper bill, and a community that&apos;s in the loop.
      </p>

      {ready && profile && !changing && (
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => router.push("/order")} className={PRIMARY_BUTTON}>
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
            <legend className="mb-3 font-semibold">Who are you?</legend>
            <div className="grid gap-2">
              {ROLES.map((r) => (
                <label
                  key={r}
                  className={`flex min-h-11 cursor-pointer items-start gap-3 rounded border p-3 ${
                    role === r ? "border-ink bg-paper" : "border-rule bg-paper/60"
                  }`}
                >
                  <input
                    type="radio"
                    name="role"
                    value={r}
                    checked={role === r}
                    onChange={() => setRole(r)}
                    className="mt-1.5"
                  />
                  <span>
                    <span className="block font-semibold">{ROLE_LABEL[r]}</span>
                    <span className="block">{ROLE_PITCH[r]}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          {role && (
            <div className="mt-5">
              <label htmlFor="profile-name" className="mb-1 block font-semibold">
                {NAME_LABEL[role]}
              </label>
              <input
                id="profile-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={40}
                required
                autoComplete="off"
                className="w-full rounded border border-rule bg-paper p-3 text-base"
              />
              <button type="submit" disabled={!name.trim()} className={`${PRIMARY_BUTTON} mt-4`}>
                Continue
              </button>
            </div>
          )}
        </form>
      )}
    </main>
  );
}
