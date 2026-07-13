"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/cases",     label: "Queue" },
  { href: "/",          label: "Active Case", exact: true },
  { href: "/entities",  label: "Entities" },
  { href: "/audit",     label: "Audit" },
];

export default function NavBar() {
  const pathname = usePathname();

  return (
    <nav className="nav-bar">
      <div className="nav-brand">
        <div className="brand-dot" />
        <span className="brand-name">Tadpools</span>
        <span className="brand-tag">KYC</span>
      </div>
      <div className="nav-links">
        {NAV_LINKS.map(({ href, label, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`nav-link${active ? " nav-link--active" : ""}`}
            >
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
