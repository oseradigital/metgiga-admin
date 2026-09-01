"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Overview" },
  { href: "/organisations", label: "Organisations" },
  { href: "/deals", label: "Deals" },
  { href: "/tasks", label: "Tasks" },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

// Split out from AdminHeader (a server component) specifically because
// knowing "which page is this" needs usePathname(), which needs a
// client boundary — the header itself stays server-rendered.
export function NavLinks() {
  const pathname = usePathname();

  return (
    <nav className="hidden sm:flex items-center gap-6 text-sm">
      {LINKS.map((link) => {
        const active = isActive(pathname, link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={`pb-0.5 border-b-2 transition-colors ${
              active
                ? "border-copper text-midnight font-medium"
                : "border-transparent text-grey-on-light hover:text-midnight"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
