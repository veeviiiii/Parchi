"use client";

import Link from "next/link";
import type { Profile } from "@/lib/profile";
import { ROLE_LABEL } from "@/lib/roles";
import { ThemeMenu } from "./Menus";

// The design's nav, on the Crowdmind, bill and role pages: logo left, links in the middle, theme and "who am I" on the right.
export default function AppHeader({ profile }: { profile: Profile | null }) {
  return (
    <div className="pnav print:hidden">
      <nav aria-label="Main">
        <div className="wrap nav-row">
          <Link className="logo" href="/" style={{ fontSize: "1.6rem" }}>
            parchi<i>.</i>
          </Link>
          <div className="nav-links">
            <Link className="nl" href="/#build">
              Build a Parchi
            </Link>
            <Link className="nl" href="/crowdmind">
              Crowdmind
            </Link>
          </div>
          <div className="nav-actions">
            <ThemeMenu />
            {profile && (
              <Link className="nav-who" href="/start" title="Change who you are">
                {profile.name} · {ROLE_LABEL[profile.role]}
              </Link>
            )}
          </div>
        </div>
      </nav>
    </div>
  );
}
