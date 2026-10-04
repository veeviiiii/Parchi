"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Profile } from "@/lib/profile";
import { ORDER_LABEL, ROLE_LABEL } from "@/lib/roles";
import ParchiMark from "./ParchiMark";

// Wordmark, nav, and "who am I" chip, on every role page.
export default function AppHeader({ profile }: { profile: Profile }) {
  const pathname = usePathname();
  const links = [
    { href: "/order", label: ORDER_LABEL[profile.role] },
    { href: "/crowdmind", label: "Crowdmind" },
  ];

  return (
    <header className="border-b border-rule bg-paper print:hidden">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
        <Link href="/" aria-label="Parchi home">
          <ParchiMark size="sm" />
        </Link>
        <nav className="flex gap-4">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={pathname === link.href ? "page" : undefined}
              className="min-h-11 content-center font-medium aria-[current=page]:underline aria-[current=page]:underline-offset-4"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3 text-sm">
          <span className="rounded bg-page px-2 py-1">
            {profile.name} · {ROLE_LABEL[profile.role]}
          </span>
          <Link href="/" className="underline">
            Change
          </Link>
        </div>
      </div>
    </header>
  );
}
