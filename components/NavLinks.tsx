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

// Split out from AdminSidebar (a server component) specifically because
// knowing "which page is this" needs usePathname(), which needs a
// client boundary — the sidebar itself stays server-rendered.
//
// Vertical rows with a leading dot for the active item, per the
// approved mockup — replaces the previous horizontal copper-underline
// treatment (that was the top-header design this sidebar supersedes).
export function NavLinks() {
  const pathname = usePathname();

  return (
    <ul className="space-y-0.5">
      {LINKS.map((link) => {
        const active = isActive(pathname, link.href);
        return (
          <li key={link.href}>
            <Link
              href={link.href}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-colors ${
                active ? "text-bone font-medium bg-bone/[0.06]" : "text-grey-on-dark hover:text-bone hover:bg-bone/[0.04]"
              }`}
            >
              <span
                aria-hidden="true"
                className={`size-1.5 rounded-full shrink-0 ${active ? "bg-copper" : "bg-transparent"}`}
              />
              {link.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
