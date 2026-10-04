"use client";

import Link from "next/link";
import type { Profile } from "@/lib/profile";
import { ROLE_LABEL } from "@/lib/roles";
import { ThemeMenu } from "./Menus";

// The design's nav, on the Crowdmind, bill and role pages: logo, theme, links, and "who am I".
export default function AppHeader({ profile }: { profile: Profile | null }) {
  return (
    <div className="pnav print:hidden">
      <nav aria-label="Main">
        <div className="wrap">
          <Link className="logo" href="/" style={{ fontSize: "1.6rem" }}>
            parchi<i>.</i>
          </Link>
          <div className="ctl">
            <ThemeMenu />
            <Link className="nl" href="/#build">
              Build a Parchi
            </Link>
            <Link className="nl" href="/crowdmind">
              Crowdmind
            </Link>
            {profile && (
              <Link className="nl" href="/start?change=1" title="Change who you are">
                {profile.name} · {ROLE_LABEL[profile.role]} (change)
              </Link>
            )}
          </div>
        </div>
      </nav>
    </div>
  );
}
