"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/events", label: "イベント一覧" },
  { href: "/keywords", label: "キーワード管理" },
  { href: "/settings", label: "設定" },
];

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Nav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80">
      <nav className="mx-auto flex max-w-3xl items-center gap-1 px-4 py-3 sm:gap-4 sm:px-6">
        <Link
          href="/"
          className="mr-auto whitespace-nowrap text-sm font-bold tracking-tight text-slate-900 sm:text-base dark:text-slate-100"
        >
          event_collector
        </Link>
        {LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`whitespace-nowrap rounded-md px-2 py-1.5 text-xs font-medium transition-colors sm:px-3 sm:text-sm ${
              isActive(pathname, link.href)
                ? "bg-brand-600 text-white"
                : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            }`}
          >
            {link.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
